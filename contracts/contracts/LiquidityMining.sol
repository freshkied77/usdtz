// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUSDTZ {
    function mint(address to, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IPancakeSwapPair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function sync() external;
}

contract LiquidityMining is Ownable, ReentrancyGuard {
    
    struct Pool {
        address lpToken;
        uint256 allocation;
        uint256 totalStaked;
        uint256 rewardPerShare;
        uint256 lastUpdateTime;
        bool active;
        uint256 startTime;
        uint256 endTime;
    }
    
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 pendingRewards;
        uint256 lastClaimTime;
        uint256 totalEarned;
    }
    
    uint256 public constant PRECISION = 1e18;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    
    address public usdtzToken;
    address public treasury;
    
    uint256 public totalAllocation = 10000;
    uint256 public currentRewardsPerSecond;
    uint256 public rewardsPerShare;
    uint256 public lastUpdateTime;
    uint256 public accRewardsPerShare;
    
    mapping(address => Pool) public pools;
    mapping(address => mapping(address => UserInfo)) public userInfo;
    mapping(address => bool) public poolExists;
    address[] public poolList;
    
    uint256 public referralCommission = 250;
    uint256 public constant MAX_REFERRAL_COMMISSION = 1000;
    mapping(address => address) public referrers;
    mapping(address => uint256) public referralRewards;
    mapping(address => uint256) public referralCount;
    
    uint256 public totalRewardsDistributed;
    uint256 public totalStakedValue;
    uint256 public poolCounter;
    
    bool public active = true;
    uint256 public emergencyWithdrawals = 0;
    
    event PoolAdded(address indexed lpToken, uint256 allocation, uint256 startTime, uint256 endTime);
    event PoolUpdated(address indexed lpToken, uint256 newAllocation);
    event Deposit(address indexed user, address indexed lpToken, uint256 amount, address indexed referrer);
    event Withdraw(address indexed user, address indexed lpToken, uint256 amount);
    event ClaimRewards(address indexed user, address indexed lpToken, uint256 reward);
    event EmergencyWithdraw(address indexed user, address indexed lpToken, uint256 amount);
    event ReferralReward(address indexed referrer, address indexed user, uint256 reward);
    event RewardsPerSecondUpdated(uint256 newRate);
    event PoolEnded(address indexed lpToken, uint256 remainingRewards);
    
    modifier onlyActivePool(address lpToken) {
        require(pools[lpToken].active, "Pool not active");
        require(block.timestamp >= pools[lpToken].startTime, "Pool not started");
        require(block.timestamp <= pools[lpToken].endTime, "Pool ended");
        _;
    }
    
    constructor(address _usdtz, address _treasury) {
        usdtzToken = _usdtz;
        treasury = _treasury;
        lastUpdateTime = block.timestamp;
    }
    
    function addPool(
        address lpToken,
        uint256 allocation,
        uint256 durationDays,
        uint256 startDelayDays
    ) external onlyOwner {
        require(!poolExists[lpToken], "Pool already exists");
        require(allocation <= totalAllocation, "Allocation exceeds total");
        
        uint256 startTime = block.timestamp + (startDelayDays * 1 days);
        uint256 endTime = startTime + (durationDays * 1 days);
        
        pools[lpToken] = Pool({
            lpToken: lpToken,
            allocation: allocation,
            totalStaked: 0,
            rewardPerShare: 0,
            lastUpdateTime: startTime,
            active: true,
            startTime: startTime,
            endTime: endTime
        });
        
        poolExists[lpToken] = true;
        poolList.push(lpToken);
        poolCounter++;
        
        emit PoolAdded(lpToken, allocation, startTime, endTime);
    }
    
    function updatePoolAllocation(address lpToken, uint256 newAllocation) external onlyOwner {
        require(poolExists[lpToken], "Pool does not exist");
        require(newAllocation <= totalAllocation, "Allocation exceeds total");
        
        pools[lpToken].allocation = newAllocation;
        emit PoolUpdated(lpToken, newAllocation);
    }
    
    function setRewardsPerSecond(uint256 rate) external onlyOwner {
        _updatePoolRewards();
        currentRewardsPerSecond = rate;
        emit RewardsPerSecondUpdated(rate);
    }
    
    function _updatePoolRewards() internal {
        if (block.timestamp > lastUpdateTime) {
            uint256 timeDelta = block.timestamp - lastUpdateTime;
            
            for (uint i = 0; i < poolList.length; i++) {
                address lpToken = poolList[i];
                Pool storage pool = pools[lpToken];
                
                if (!pool.active) continue;
                if (block.timestamp < pool.startTime) continue;
                
                uint256 poolTime = block.timestamp < pool.endTime 
                    ? block.timestamp - pool.lastUpdateTime 
                    : pool.endTime - pool.lastUpdateTime;
                
                if (poolTime > 0 && pool.totalStaked > 0) {
                    uint256 poolRewards = (currentRewardsPerSecond * pool.allocation * poolTime) / totalAllocation;
                    accRewardsPerShare += (poolRewards * PRECISION) / pool.totalStaked;
                    pool.lastUpdateTime = block.timestamp < pool.endTime ? block.timestamp : pool.endTime;
                }
                
                if (block.timestamp >= pool.endTime && pool.active) {
                    pool.active = false;
                    emit PoolEnded(lpToken, 0);
                }
            }
            
            lastUpdateTime = block.timestamp;
        }
    }
    
    function deposit(address lpToken, uint256 amount, address referral) external nonReentrant onlyActivePool(lpToken) {
        require(amount > 0, "Amount must be positive");
        
        _updatePoolRewards();
        Pool storage pool = pools[lpToken];
        UserInfo storage user = userInfo[lpToken][msg.sender];
        
        uint256 pending = (user.amount * accRewardsPerShare) / PRECISION - user.rewardDebt;
        
        if (pending > 0) {
            user.pendingRewards += pending;
        }
        
        if (referral != address(0) && referral != msg.sender && referrers[msg.sender] == address(0)) {
            referrers[msg.sender] = referral;
            referralCount[referral]++;
        }
        
        require(IERC20(lpToken).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        user.amount += amount;
        user.rewardDebt = (user.amount * accRewardsPerShare) / PRECISION;
        user.lastClaimTime = block.timestamp;
        pool.totalStaked += amount;
        
        _updateTotalStakedValue();
        _payReferralReward(msg.sender, pending);
        
        emit Deposit(msg.sender, lpToken, amount, referral);
    }
    
    function withdraw(address lpToken, uint256 amount) external nonReentrant {
        require(poolExists[lpToken], "Pool does not exist");
        Pool storage pool = pools[lpToken];
        UserInfo storage user = userInfo[lpToken][msg.sender];
        
        require(user.amount >= amount, "Insufficient balance");
        
        _updatePoolRewards();
        
        uint256 pending = (user.amount * accRewardsPerShare) / PRECISION - user.rewardDebt;
        
        if (pending > 0) {
            _claimReward(lpToken);
        }
        
        user.amount -= amount;
        pool.totalStaked -= amount;
        user.rewardDebt = (user.amount * accRewardsPerShare) / PRECISION;
        
        require(IERC20(lpToken).transfer(msg.sender, amount), "Transfer failed");
        
        _updateTotalStakedValue();
        
        emit Withdraw(msg.sender, lpToken, amount);
    }
    
    function claimReward(address lpToken) external nonReentrant {
        _updatePoolRewards();
        _claimReward(lpToken);
    }
    
    function _claimReward(address lpToken) internal {
        Pool storage pool = pools[lpToken];
        UserInfo storage user = userInfo[lpToken][msg.sender];
        
        uint256 pending = user.pendingRewards + 
            ((user.amount * accRewardsPerShare) / PRECISION - user.rewardDebt);
        
        require(pending > 0, "No rewards to claim");
        
        user.pendingRewards = 0;
        user.rewardDebt = (user.amount * accRewardsPerShare) / PRECISION;
        user.lastClaimTime = block.timestamp;
        user.totalEarned += pending;
        
        IUSDTZ(usdtzToken).mint(msg.sender, pending);
        totalRewardsDistributed += pending;
        
        _payReferralReward(msg.sender, pending);
        
        emit ClaimRewards(msg.sender, lpToken, pending);
    }
    
    function _payReferralReward(address userAddr, uint256 reward) internal {
        address referrer = referrers[userAddr];
        if (referrer == address(0)) return;
        if (reward == 0) return;
        
        uint256 commission = (reward * referralCommission) / 10000;
        if (commission > 0) {
            IUSDTZ(usdtzToken).mint(referrer, commission);
            referralRewards[referrer] += commission;
            totalRewardsDistributed += commission;
            emit ReferralReward(referrer, userAddr, commission);
        }
    }
    
    function emergencyWithdraw(address lpToken) external nonReentrant {
        Pool storage pool = pools[lpToken];
        UserInfo storage user = userInfo[lpToken][msg.sender];
        
        require(user.amount > 0, "Nothing to withdraw");
        require(emergencyWithdrawals < 100, "Emergency withdrawals limit reached");
        
        uint256 amount = user.amount;
        pool.totalStaked -= amount;
        user.amount = 0;
        user.rewardDebt = 0;
        user.pendingRewards = 0;
        
        require(IERC20(lpToken).transfer(msg.sender, amount), "Transfer failed");
        
        emergencyWithdrawals++;
        _updateTotalStakedValue();
        
        emit EmergencyWithdraw(msg.sender, lpToken, amount);
    }
    
    function _updateTotalStakedValue() internal {
        totalStakedValue = 0;
        for (uint i = 0; i < poolList.length; i++) {
            totalStakedValue += pools[poolList[i]].totalStaked;
        }
    }
    
    function getPoolInfo(address lpToken) external view returns (
        uint256 allocation,
        uint256 totalStaked,
        bool active,
        uint256 startTime,
        uint256 endTime,
        uint256 remainingDays
    ) {
        Pool storage pool = pools[lpToken];
        return (
            pool.allocation,
            pool.totalStaked,
            pool.active && block.timestamp >= pool.startTime && block.timestamp <= pool.endTime,
            pool.startTime,
            pool.endTime,
            block.timestamp < pool.endTime ? (pool.endTime - block.timestamp) / 1 days : 0
        );
    }
    
    function getUserInfo(address lpToken, address userAddr) external view returns (
        uint256 amount,
        uint256 pendingRewards,
        uint256 totalEarned,
        uint256 lastClaimTime
    ) {
        UserInfo storage user = userInfo[lpToken][userAddr];
        return (
            user.amount,
            user.pendingRewards,
            user.totalEarned,
            user.lastClaimTime
        );
    }
    
    function getPendingReward(address lpToken, address userAddr) external view returns (uint256) {
        Pool storage pool = pools[lpToken];
        UserInfo storage user = userInfo[lpToken][userAddr];
        
        uint256 pending = user.pendingRewards;
        if (user.amount > 0) {
            uint256 share = accRewardsPerShare;
            pending += (user.amount * share) / PRECISION - user.rewardDebt;
        }
        return pending;
    }
    
    function setReferralCommission(uint256 commission) external onlyOwner {
        require(commission <= MAX_REFERRAL_COMMISSION, "Commission too high");
        referralCommission = commission;
    }
    
    function getStats() external view returns (
        uint256 _totalRewardsDistributed,
        uint256 _totalStakedValue,
        uint256 _poolCount,
        uint256 _currentRewardsPerSecond,
        uint256 _totalReferralRewards
    ) {
        uint256 totalRefRewards = 0;
        for (uint i = 0; i < poolList.length; i++) {
            totalRefRewards += referralRewards[poolList[i]];
        }
        return (
            totalRewardsDistributed,
            totalStakedValue,
            poolCounter,
            currentRewardsPerSecond,
            totalRefRewards
        );
    }
}