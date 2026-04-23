// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

interface IUSDTZ {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IPoolManager {
    function pools(address token) external view returns (
        address tokenAddr,
        uint256 weight,
        uint256 tvl,
        uint256 lastHarvest,
        bool active
    );
    function totalTVL() external view returns (uint256);
}

contract PredictionMarket is Ownable, ReentrancyGuard, ERC20, ERC20Burnable {
    
    uint256 public constant FEE_BPS = 25;
    uint256 public constant PROTOCOL_FEE_BPS = 100;
    uint256 public constant SCALE = 1e18;
    
    struct Market {
        string question;
        uint256 resolveTime;
        bool resolved;
        bool answer;
        uint256 totalYES;
        uint256 totalNO;
        uint256 yesOdds;
        uint256 noOdds;
        bool cancelled;
    }
    
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => uint256)) public userYESBets;
    mapping(uint256 => mapping(address => uint256)) public userNOBets;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    
    uint256 public marketCounter;
    address public usdtzToken;
    address public treasuryAddress;
    address public poolManager;
    
    uint256 public protocolFeeBps = 100;
    uint256 public creatorRewardBps = 50;
    
    event MarketCreated(uint256 indexed marketId, string question, uint256 resolveTime, address creator);
    event MarketResolved(uint256 indexed marketId, bool answer, uint256 yesOdds, uint256 noOdds);
    event MarketCancelled(uint256 indexed marketId);
    event PlaceBet(uint256 indexed marketId, bool isYes, uint256 amount, address user);
    event ClaimRewards(uint256 indexed marketId, address indexed user, uint256 amount);
    event WithdrawProfits(uint256 indexed marketId, address indexed user, uint256 amount);
    
    modifier marketExists(uint256 marketId) {
        require(marketId < marketCounter, "Market does not exist");
        require(!markets[marketId].cancelled, "Market cancelled");
        _;
    }
    
    modifier marketNotResolved(uint256 marketId) {
        require(!markets[marketId].resolved, "Already resolved");
        _;
    }
    
    constructor(
        address _usdtz,
        address _treasury,
        address _poolManager
    ) ERC20("USDTZ Prediction Shares", "USDTZ-PRED") {
        usdtzToken = _usdtz;
        treasuryAddress = _treasury;
        poolManager = _poolManager;
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        treasuryAddress = _treasury;
    }
    
    function setPoolManager(address _manager) external onlyOwner {
        poolManager = _manager;
    }
    
    function setProtocolFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "Fee too high");
        protocolFeeBps = _feeBps;
    }
    
    function createMarket(
        string memory question,
        uint256 resolveTime,
        uint256 initialLiquidity
    ) external nonReentrant returns (uint256 marketId) {
        require(bytes(question).length > 0, "Empty question");
        require(resolveTime > block.timestamp + 1 hours, "Resolve time too soon");
        require(initialLiquidity > 0, "No initial liquidity");
        
        marketId = marketCounter++;
        
        markets[marketId] = Market({
            question: question,
            resolveTime: resolveTime,
            resolved: false,
            answer: false,
            totalYES: 0,
            totalNO: 0,
            yesOdds: SCALE,
            noOdds: SCALE,
            cancelled: false
        });
        
        require(
            IUSDTZ(usdtzToken).transferFrom(msg.sender, address(this), initialLiquidity),
            "Transfer failed"
        );
        
        emit MarketCreated(marketId, question, resolveTime, msg.sender);
    }
    
    function placeBet(uint256 marketId, bool isYes, uint256 amount) 
        external 
        nonReentrant 
        marketExists(marketId) 
        marketNotResolved(marketId) 
    {
        require(amount > 0, "Amount must be positive");
        require(block.timestamp < markets[marketId].resolveTime, "Market closed");
        
        Market storage market = markets[marketId];
        
        require(
            IUSDTZ(usdtzToken).transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        
        if (isYes) {
            market.totalYES += amount;
            userYESBets[marketId][msg.sender] += amount;
        } else {
            market.totalNO += amount;
            userNOBets[marketId][msg.sender] += amount;
        }
        
        _updateOdds(market);
        
        emit PlaceBet(marketId, isYes, amount, msg.sender);
    }
    
    function _updateOdds(Market storage market) internal {
        uint256 totalPool = market.totalYES + market.totalNO;
        if (totalPool == 0) {
            market.yesOdds = SCALE;
            market.noOdds = SCALE;
            return;
        }
        
        uint256 totalFees = (totalPool * protocolFeeBps) / 10000;
        uint256 liquidityNet = totalPool - totalFees;
        
        if (market.totalYES > 0) {
            market.yesOdds = (liquidityNet * SCALE) / market.totalYES;
        }
        if (market.totalNO > 0) {
            market.noOdds = (liquidityNet * SCALE) / market.totalNO;
        }
    }
    
    function resolveMarket(uint256 marketId, bool answer) 
        external 
        onlyOwner 
        marketExists(marketId) 
        marketNotResolved(marketId) 
    {
        require(block.timestamp >= markets[marketId].resolveTime, "Too early to resolve");
        
        Market storage market = markets[marketId];
        market.resolved = true;
        market.answer = answer;
        
        _updateOdds(market);
        
        emit MarketResolved(marketId, answer, market.yesOdds, market.noOdds);
    }
    
    function cancelMarket(uint256 marketId)
        external
        onlyOwner
        marketExists(marketId)
        marketNotResolved(marketId)
    {
        Market storage market = markets[marketId];
        market.cancelled = true;

        // Bettors claim refunds individually via claimRewards()
        emit MarketCancelled(marketId);
    }
    
    function claimRewards(uint256 marketId)
        external
        nonReentrant
    {
        require(marketId < marketCounter, "Market does not exist");
        require(markets[marketId].resolved || markets[marketId].cancelled, "Market not resolved");
        require(!hasClaimed[marketId][msg.sender], "Already claimed");
        
        Market storage market = markets[marketId];
        uint256 payout;
        
        if (market.cancelled) {
            payout = userYESBets[marketId][msg.sender] + userNOBets[marketId][msg.sender];
            uint256 fee = (payout * protocolFeeBps) / 10000;
            payout = payout - fee;
        } else {
            if (market.answer) {
                payout = userYESBets[marketId][msg.sender] * market.yesOdds / SCALE;
            } else {
                payout = userNOBets[marketId][msg.sender] * market.noOdds / SCALE;
            }
        }
        
        require(payout > 0, "No payout");
        
        hasClaimed[marketId][msg.sender] = true;
        
        require(
            IUSDTZ(usdtzToken).transfer(msg.sender, payout),
            "Transfer failed"
        );
        
        emit ClaimRewards(marketId, msg.sender, payout);
    }
    
    function getMarketInfo(uint256 marketId) external view returns (
        string memory question,
        uint256 resolveTime,
        bool resolved,
        bool answer,
        uint256 totalYES,
        uint256 totalNO,
        uint256 yesOdds,
        uint256 noOdds,
        bool cancelled,
        uint256 userBetYes,
        uint256 userBetNo,
        bool userClaimed
    ) {
        Market storage market = markets[marketId];
        question = market.question;
        resolveTime = market.resolveTime;
        resolved = market.resolved;
        answer = market.answer;
        totalYES = market.totalYES;
        totalNO = market.totalNO;
        yesOdds = market.yesOdds;
        noOdds = market.noOdds;
        cancelled = market.cancelled;
        userBetYes = userYESBets[marketId][msg.sender];
        userBetNo = userNOBets[marketId][msg.sender];
        userClaimed = hasClaimed[marketId][msg.sender];
    }
    
    function getUserPayout(uint256 marketId, address user) external view returns (uint256 payout) {
        Market storage market = markets[marketId];
        
        if (market.cancelled) {
            payout = userYESBets[marketId][user] + userNOBets[marketId][user];
            payout = payout - (payout * protocolFeeBps) / 10000;
        } else if (market.resolved) {
            if (market.answer) {
                payout = userYESBets[marketId][user] * market.yesOdds / SCALE;
            } else {
                payout = userNOBets[marketId][user] * market.noOdds / SCALE;
            }
        }
    }
    
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(IUSDTZ(usdtzToken).transfer(msg.sender, amount), "Transfer failed");
    }
}