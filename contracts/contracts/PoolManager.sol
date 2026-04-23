// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IPriceOracle {
    function getPrice(address token) external view returns (uint256);
    function getLatestAnswer() external view returns (int256);
}

interface IUSDTZ {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

contract PoolManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    struct Pool {
        address token;
        uint256 weight;
        uint256 tvl;
        uint256 lastHarvest;
        bool active;
    }
    
    struct RiskParams {
        uint256 maxTVL;
        uint256 volatilityTolerance;
        uint256 rebalancingIncentive;
        uint256 exposureLimit;
    }
    
    mapping(address => Pool) public pools;
    mapping(address => bool) public approvedTokens;
    address[] public poolTokens;
    
    uint256 public totalTVL;
    uint256 public rebalancingThreshold = 50e16;
    uint256 public performanceFee = 200;
    uint256 public harvestInterval = 24 hours;
    
    uint256 public rebalancingDelay = 1 hours;
    uint256 public lastGlobalRebalance;
    
    mapping(address => uint256) public userDeposits;
    mapping(address => uint256) public userRewards;
    mapping(address => uint256) public lastUserClaim;
    
    address public immutable usdtzToken;
    address public immutable treasury;
    address public priceOracle;
    
    uint256 public constant PRECISION = 1e18;
    uint256 public constant MAX_TVL = 1000000000e18;
    
    event PoolCreated(address indexed token, uint256 weight);
    event Deposit(address indexed user, address indexed token, uint256 amount);
    event Withdraw(address indexed user, address indexed token, uint256 amount);
    event Harvest(address indexed token, uint256 rewards, uint256 fee);
    event Rebalance(address indexed token, uint256 newWeight, uint256 tvl);
    event RiskParamsUpdated(uint256 maxTVL, uint256 volatilityTolerance);
    
    constructor(address _usdtz, address _treasury) {
        usdtzToken = _usdtz;
        treasury = _treasury;
    }
    
    function setPriceOracle(address _oracle) external onlyOwner {
        priceOracle = _oracle;
    }
    
    function createPool(address token, uint256 weight) external onlyOwner {
        require(!pools[token].active, "Pool already exists");
        pools[token] = Pool({
            token: token,
            weight: weight,
            tvl: 0,
            lastHarvest: block.timestamp,
            active: true
        });
        approvedTokens[token] = true;
        poolTokens.push(token);
        emit PoolCreated(token, weight);
    }
    
    function updatePoolWeight(address token, uint256 newWeight) external onlyOwner {
        require(pools[token].active, "Pool does not exist");
        pools[token].weight = newWeight;
        emit Rebalance(token, newWeight, pools[token].tvl);
    }
    
    function deposit(address token, uint256 amount) external nonReentrant {
        require(pools[token].active, "Pool does not exist");
        require(amount > 0, "Amount must be positive");
        
        Pool storage pool = pools[token];
        uint256 depositValue = amount;
        
        if (priceOracle != address(0)) {
            depositValue = amount * IPriceOracle(priceOracle).getPrice(token) / 1e18;
        }
        
        require(pool.tvl + depositValue <= MAX_TVL, "Pool TVL limit reached");
        
        // Actually transfer the tokens
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        pool.tvl += depositValue;
        totalTVL += depositValue;
        userDeposits[msg.sender] += depositValue;

        emit Deposit(msg.sender, token, amount);

        if (shouldRebalance()) {
            rebalance();
        }
    }
    
    function withdraw(address token, uint256 amount) external nonReentrant {
        require(pools[token].active, "Pool does not exist");
        Pool storage pool = pools[token];
        
        uint256 withdrawValue = amount;
        if (priceOracle != address(0)) {
            withdrawValue = amount * IPriceOracle(priceOracle).getPrice(token) / 1e18;
        }
        
        require(userDeposits[msg.sender] >= withdrawValue, "Insufficient deposit");
        require(pool.tvl >= withdrawValue, "Insufficient pool liquidity");
        
        pool.tvl -= withdrawValue;
        totalTVL -= withdrawValue;
        userDeposits[msg.sender] -= withdrawValue;

        // Actually transfer the tokens back to user
        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, token, amount);
    }
    
    function harvest(address token) external nonReentrant {
        Pool storage pool = pools[token];
        require(pool.active, "Pool does not exist");
        require(block.timestamp - pool.lastHarvest >= harvestInterval, "Harvest interval not reached");
        
        uint256 poolRewards = calculatePoolRewards(token);
        uint256 fee = (poolRewards * performanceFee) / 10000;
        uint256 netRewards = poolRewards - fee;
        
        pool.lastHarvest = block.timestamp;
        
        if (fee > 0) {
            IERC20(token).safeTransfer(treasury, fee);
        }
        
        emit Harvest(token, netRewards, fee);
    }
    
    function calculatePoolRewards(address token) public view returns (uint256) {
        Pool storage pool = pools[token];
        if (pool.lastHarvest >= block.timestamp) return 0;
        
        uint256 timeSinceLastHarvest = block.timestamp - pool.lastHarvest;
        uint256 annualYield = (pool.tvl * 500) / 10000;
        
        return (annualYield * timeSinceLastHarvest) / 365 days;
    }
    
    function shouldRebalance() public view returns (bool) {
        return block.timestamp - lastGlobalRebalance >= rebalancingDelay;
    }
    
    function rebalance() public {
        require(shouldRebalance(), "Rebalancing not needed");

        uint256 totalWeight = 0;
        for (uint i = 0; i < poolTokens.length; i++) {
            if (pools[poolTokens[i]].active) {
                totalWeight += pools[poolTokens[i]].weight;
            }
        }
        require(totalWeight > 0, "No active pools");

        // Move excess from overweight pools to treasury, then redistribute
        for (uint i = 0; i < poolTokens.length; i++) {
            address token = poolTokens[i];
            Pool storage pool = pools[token];
            if (!pool.active) continue;

            uint256 targetTVL = (pool.weight * totalTVL) / totalWeight;

            if (pool.tvl > targetTVL) {
                uint256 excess = pool.tvl - targetTVL;
                // Move 90% of excess to treasury to reduce pool size toward target
                uint256 excessToMove = (excess * 90) / 100;

                if (excessToMove > 0) {
                    uint256 tokenAmount = excessToMove;
                    if (priceOracle != address(0)) {
                        uint256 tokenPrice = IPriceOracle(priceOracle).getPrice(token);
                        if (tokenPrice > 0) {
                            tokenAmount = (excessToMove * 1e18) / tokenPrice;
                        }
                    }

                    uint256 contractBalance = IERC20(token).balanceOf(address(this));
                    if (tokenAmount > contractBalance) tokenAmount = contractBalance;

                    if (tokenAmount > 0) {
                        IERC20(token).safeTransfer(treasury, tokenAmount);
                        pool.tvl -= excessToMove;
                        totalTVL -= excessToMove;
                    }
                }
            }

            emit Rebalance(token, pool.weight, pool.tvl);
        }

        lastGlobalRebalance = block.timestamp;
    }
    
    function getPoolInfo(address token) external view returns (
        uint256 weight, 
        uint256 tvl, 
        uint256 userDeposit,
        uint256 pendingRewards
    ) {
        Pool storage pool = pools[token];
        return (
            pool.weight,
            pool.tvl,
            userDeposits[msg.sender],
            calculateUserRewards(token)
        );
    }
    
    function calculateUserRewards(address token) public view returns (uint256) {
        Pool storage pool = pools[token];
        if (userDeposits[msg.sender] == 0 || pool.tvl == 0) return 0;

        uint256 poolRewards = calculatePoolRewards(token);
        uint256 userShare = (userDeposits[msg.sender] * poolRewards) / pool.tvl;

        return userShare;
    }
    
    function claimRewards(address token) external nonReentrant {
        uint256 rewards = calculateUserRewards(token);
        require(rewards > 0, "No rewards to claim");
        
        lastUserClaim[msg.sender] = block.timestamp;
        userRewards[msg.sender] += rewards;
        
        IERC20(token).safeTransfer(msg.sender, rewards);
    }
    
    function emergencyShutdown() external onlyOwner {
        for (uint i = 0; i < poolTokens.length; i++) {
            pools[poolTokens[i]].active = false;
        }
    }
    
    function getCollateralRatio() external view returns (uint256) {
        return (totalTVL * PRECISION) / IUSDTZ(usdtzToken).totalSupply();
    }
    
    function getMintFee() external view returns (uint256) {
        return 25;
    }
    
    function getRedeemFee() external view returns (uint256) {
        return 25;
    }
    
    function getLiquidationThreshold() external view returns (uint256) {
        return 120e16;
    }
    
    function getProtocolCollateralValue() external view returns (uint256) {
        return totalTVL;
    }
}

