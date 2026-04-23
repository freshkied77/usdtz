// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ICrossChainBridge {
    function bridgeToZedx(address token, uint256 amount, address recipient) external;
}

contract LiquidityVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    struct ChainLiquidity {
        uint256 chainId;
        string name;
        uint256 totalBalance;
        uint256 availableBalance;
        uint256 lockedBalance;
        uint256 lastRebalance;
        bool active;
    }
    
    struct TokenLiquidity {
        address token;
        uint256 totalDeposited;
        uint256 totalWithdrawn;
        uint256 currentBalance;
        uint256 bridgeReserve;
        uint256 farmReserve;
        uint256 emergencyReserve;
        uint256 dailyLimit;
        uint256 dailyUsed;
        uint256 lastReset;
    }
    
    struct LiquidityRequest {
        address user;
        address token;
        uint256 amount;
        uint256 chainId;
        uint256 timestamp;
        uint256 unlockTime;
        bool claimed;
        bool cancelled;
    }
    
    mapping(address => TokenLiquidity) public tokenLiquidity;
    mapping(uint256 => ChainLiquidity) public chainLiquidity;
    mapping(address => mapping(uint256 => uint256)) public userChainBalance;
    mapping(bytes32 => LiquidityRequest) public liquidityRequests;
    
    address public usdtzToken;
    address public crossChainBridge;
    address public farmContract;
    address public treasuryAddress;
    
    uint256 public constant REBALANCE_INTERVAL = 24 hours;
    uint256 public constant EMERGENCY_RESERVE_PERCENT = 50;
    uint256 public constant BRIDGE_RESERVE_PERCENT = 30;
    uint256 public constant FARM_RESERVE_PERCENT = 20;
    uint256 public constant MIN_LIQUIDITY_THRESHOLD = 10000 ether;
    uint256 public constant DAILY_WITHDRAW_LIMIT_PERCENT = 10;
    
    uint256[] public supportedChainIds;
    address[] public supportedTokens;
    
    event LiquidityDeposited(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 chainId
    );
    
    event LiquidityWithdrawn(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 chainId
    );
    
    event ChainRebalanced(
        uint256 indexed chainId,
        uint256 totalBalance,
        uint256 redistributed
    );
    
    event EmergencyWithdraw(
        address indexed token,
        uint256 amount,
        address recipient
    );
    
    event BridgeReserveUpdated(
        address indexed token,
        uint256 newAmount
    );
    
    modifier onlyBridgeOrFarm() {
        require(msg.sender == crossChainBridge || msg.sender == farmContract, "Not authorized");
        _;
    }
    
    constructor(address _usdtzToken) {
        usdtzToken = _usdtzToken;
    }
    
    function setCrossChainBridge(address _bridge) external onlyOwner {
        crossChainBridge = _bridge;
    }
    
    function setFarmContract(address _farm) external onlyOwner {
        farmContract = _farm;
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        treasuryAddress = _treasury;
    }
    
    function addSupportedChain(
        uint256 chainId,
        string memory name,
        uint256 initialBalance
    ) external onlyOwner {
        require(chainLiquidity[chainId].chainId == 0, "Chain already exists");
        
        chainLiquidity[chainId] = ChainLiquidity({
            chainId: chainId,
            name: name,
            totalBalance: initialBalance,
            availableBalance: initialBalance,
            lockedBalance: 0,
            lastRebalance: block.timestamp,
            active: true
        });
        
        supportedChainIds.push(chainId);
    }
    
    function addSupportedToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token");
        if (tokenLiquidity[token].totalDeposited == 0) {
            supportedTokens.push(token);
        }
        
        tokenLiquidity[token].dailyLimit = 1000000 ether;
        tokenLiquidity[token].lastReset = block.timestamp;
    }
    
    function deposit(address token, uint256 amount, uint256 chainId) external nonReentrant {
        require(amount > 0, "Amount must be positive");
        require(chainLiquidity[chainId].active, "Chain not supported");
        
        TokenLiquidity storage tokenData = tokenLiquidity[token];
        ChainLiquidity storage chainData = chainLiquidity[chainId];
        
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        uint256 bridgeAllocation = (amount * BRIDGE_RESERVE_PERCENT) / 100;
        uint256 farmAllocation = (amount * FARM_RESERVE_PERCENT) / 100;
        uint256 emergencyAllocation = (amount * EMERGENCY_RESERVE_PERCENT) / 100;
        
        tokenData.bridgeReserve += bridgeAllocation;
        tokenData.farmReserve += farmAllocation;
        tokenData.emergencyReserve += emergencyAllocation;
        tokenData.totalDeposited += amount;
        tokenData.currentBalance += amount;
        
        chainData.availableBalance += amount;
        chainData.totalBalance += amount;
        
        userChainBalance[msg.sender][chainId] += amount;
        
        emit LiquidityDeposited(msg.sender, token, amount, chainId);
    }
    
    function withdraw(address token, uint256 amount, uint256 chainId) external nonReentrant {
        require(amount > 0, "Amount must be positive");
        
        TokenLiquidity storage tokenData = tokenLiquidity[token];
        ChainLiquidity storage chainData = chainLiquidity[chainId];
        
        require(userChainBalance[msg.sender][chainId] >= amount, "Insufficient balance");
        require(chainData.active, "Chain not supported");
        
        if (block.timestamp - tokenData.lastReset > 1 days) {
            tokenData.dailyUsed = 0;
            tokenData.lastReset = block.timestamp;
        }
        
        uint256 maxDailyWithdraw = (tokenData.currentBalance * DAILY_WITHDRAW_LIMIT_PERCENT) / 100;
        require(tokenData.dailyUsed + amount <= maxDailyWithdraw, "Daily limit exceeded");
        
        uint256 available = chainData.availableBalance;
        uint256 totalRequired = amount;
        
        if (available < amount) {
            uint256 deficit = amount - available;
            
            if (tokenData.bridgeReserve >= deficit) {
                tokenData.bridgeReserve -= deficit;
            } else if (tokenData.farmReserve >= deficit) {
                tokenData.farmReserve -= deficit;
            } else {
                require(tokenData.emergencyReserve >= deficit, "Insufficient liquidity");
                tokenData.emergencyReserve -= deficit;
            }
        }
        
        tokenData.currentBalance -= amount;
        tokenData.totalWithdrawn += amount;
        tokenData.dailyUsed += amount;
        
        chainData.availableBalance -= amount > available ? available : amount;
        chainData.totalBalance -= amount > available ? available : amount;
        
        userChainBalance[msg.sender][chainId] -= amount;
        
        IERC20(token).safeTransfer(msg.sender, amount);
        
        emit LiquidityWithdrawn(msg.sender, token, amount, chainId);
    }
    
    function addLiquidity(address token, uint256 amount) external onlyBridgeOrFarm {
        require(amount > 0, "Amount must be positive");
        
        TokenLiquidity storage tokenData = tokenLiquidity[token];
        
        if (tokenData.totalDeposited == 0) {
            supportedTokens.push(token);
        }
        
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        tokenData.currentBalance += amount;
        tokenData.totalDeposited += amount;
        tokenData.bridgeReserve += (amount * 60) / 100;
        tokenData.farmReserve += (amount * 25) / 100;
        tokenData.emergencyReserve += (amount * 15) / 100;
        
        emit LiquidityDeposited(msg.sender, token, amount, 0);
    }
    
    function removeLiquidity(address token, uint256 amount, address recipient) external onlyBridgeOrFarm {
        require(amount > 0, "Amount must be positive");
        require(recipient != address(0), "Invalid recipient");
        
        TokenLiquidity storage tokenData = tokenLiquidity[token];
        require(tokenData.currentBalance >= amount, "Insufficient balance");
        
        tokenData.currentBalance -= amount;
        tokenData.emergencyReserve -= (amount * EMERGENCY_RESERVE_PERCENT) / 100;
        
        IERC20(token).safeTransfer(recipient, amount);
        
        emit LiquidityWithdrawn(recipient, token, amount, 0);
    }
    
    function getVaultBalance(address token) external view returns (uint256) {
        return tokenLiquidity[token].currentBalance;
    }
    
    function getOptimalAmount(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256) {
        TokenLiquidity storage inputToken = tokenLiquidity[tokenIn];
        TokenLiquidity storage outputToken = tokenLiquidity[tokenOut];
        
        if (outputToken.currentBalance == 0) return 0;
        
        uint256 maxOut = (amountIn * 90) / 100;
        return maxOut > outputToken.currentBalance ? outputToken.currentBalance : maxOut;
    }
    
    function rebalanceChain(uint256 chainId) external onlyOwner {
        ChainLiquidity storage chainData = chainLiquidity[chainId];
        require(chainData.active, "Chain not supported");
        require(block.timestamp - chainData.lastRebalance >= REBALANCE_INTERVAL, "Too soon");
        
        uint256 totalAvailable = chainData.availableBalance;
        
        if (totalAvailable < MIN_LIQUIDITY_THRESHOLD) {
            uint256 deficit = MIN_LIQUIDITY_THRESHOLD - totalAvailable;
            require(tokenLiquidity[usdtzToken].emergencyReserve >= deficit, "No reserves available");
            
            tokenLiquidity[usdtzToken].emergencyReserve -= deficit;
            chainData.availableBalance += deficit;
        }
        
        chainData.lastRebalance = block.timestamp;
        
        emit ChainRebalanced(chainId, chainData.totalBalance, 0);
    }
    
    function allocateToBridge(address token, uint256 amount, uint256 destinationChain) external onlyOwner {
        TokenLiquidity storage tokenData = tokenLiquidity[token];
        require(tokenData.bridgeReserve >= amount, "Insufficient bridge reserve");
        
        tokenData.bridgeReserve -= amount;
        chainLiquidity[destinationChain].availableBalance += amount;
    }
    
    function allocateToFarm(address token, uint256 amount) external onlyOwner {
        TokenLiquidity storage tokenData = tokenLiquidity[token];
        require(tokenData.farmReserve >= amount, "Insufficient farm reserve");
        
        tokenData.farmReserve -= amount;
        tokenData.emergencyReserve += amount;
    }
    
    function getTokenBreakdown(address token) external view returns (
        uint256 currentBalance,
        uint256 bridgeReserve,
        uint256 farmReserve,
        uint256 emergencyReserve,
        uint256 totalDeposited,
        uint256 totalWithdrawn
    ) {
        TokenLiquidity storage tokenData = tokenLiquidity[token];
        return (
            tokenData.currentBalance,
            tokenData.bridgeReserve,
            tokenData.farmReserve,
            tokenData.emergencyReserve,
            tokenData.totalDeposited,
            tokenData.totalWithdrawn
        );
    }
    
    function getChainBreakdown(uint256 chainId) external view returns (
        uint256 totalBalance,
        uint256 availableBalance,
        uint256 lockedBalance,
        bool active,
        uint256 lastRebalance
    ) {
        ChainLiquidity storage chainData = chainLiquidity[chainId];
        return (
            chainData.totalBalance,
            chainData.availableBalance,
            chainData.lockedBalance,
            chainData.active,
            chainData.lastRebalance
        );
    }
    
    function getUserPosition(address user, address token, uint256 chainId) external view returns (
        uint256 balance,
        uint256 claimable,
        uint256 dailyLimit
    ) {
        TokenLiquidity storage tokenData = tokenLiquidity[token];
        uint256 used = tokenData.dailyUsed;
        if (block.timestamp - tokenData.lastReset > 1 days) {
            used = 0;
        }
        
        return (
            userChainBalance[user][chainId],
            userChainBalance[user][chainId],
            (tokenData.currentBalance * DAILY_WITHDRAW_LIMIT_PERCENT) / 100 - used
        );
    }
    
    function emergencyWithdrawToken(address token, uint256 amount) external onlyOwner {
        TokenLiquidity storage tokenData = tokenLiquidity[token];
        require(tokenData.emergencyReserve >= amount, "Insufficient emergency reserve");
        
        tokenData.emergencyReserve -= amount;
        tokenData.currentBalance -= amount;
        
        IERC20(token).safeTransfer(treasuryAddress, amount);
        
        emit EmergencyWithdraw(token, amount, treasuryAddress);
    }
    
    function setChainActive(uint256 chainId, bool active) external onlyOwner {
        chainLiquidity[chainId].active = active;
    }
    
    function setDailyLimit(address token, uint256 newLimit) external onlyOwner {
        tokenLiquidity[token].dailyLimit = newLimit;
    }
}