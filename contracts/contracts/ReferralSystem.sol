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

contract ReferralSystem is Ownable, ReentrancyGuard {
    
    uint256 public constant TIER1_LEVEL = 5;
    uint256 public constant TIER2_LEVEL = 20;
    uint256 public constant TIER3_LEVEL = 50;
    
    uint256 public constant TIER1_REWARDS = 300;
    uint256 public constant TIER2_REWARDS = 500;
    uint256 public constant TIER3_REWARDS = 750;
    uint256 public constant BASE_REWARDS = 200;
    uint256 public constant MAX_REWARD = 10000e18;
    
    uint256 public totalReferrals;
    uint256 public totalRewardsDistributed;
    uint256 public activeReferrers;
    
    struct ReferrerInfo {
        address referrer;
        uint256 totalReferred;
        uint256 totalEarnings;
        uint256 tier;
        uint256 lastRewardTime;
        bool active;
    }
    
    mapping(address => ReferrerInfo) public referrerData;
    mapping(address => address[]) public referralsByUser;
    mapping(address => mapping(address => bool)) public hasReferred;
    
    address public usdtzToken;
    address public liquidityMining;
    address public treasury;
    
    uint256 public rewardsPerReferral = 200;
    uint256 public tier1Threshold = 5;
    uint256 public tier2Threshold = 20;
    uint256 public tier3Threshold = 50;
    
    mapping(address => uint256) public userReferralCount;
    mapping(address => address) public userReferrer;
    
    event ReferrerRegistered(address indexed user, address indexed referrer);
    event ReferralRewarded(address indexed referrer, address indexed user, uint256 reward, uint256 tier);
    event TierUpgraded(address indexed referrer, uint256 oldTier, uint256 newTier);
    event RewardsConfigUpdated(uint256 baseRewards, uint256 tier1, uint256 tier2, uint256 tier3);
    
    constructor(address _usdtz, address _treasury) {
        usdtzToken = _usdtz;
        treasury = _treasury;
    }
    
    function setLiquidityMining(address _liquidityMining) external onlyOwner {
        liquidityMining = _liquidityMining;
    }
    
    function registerReferral(address user, address referrer) external onlyOwner returns (uint256 reward) {
        require(user != address(0) && referrer != address(0), "Invalid addresses");
        require(user != referrer, "Cannot refer self");
        require(!hasReferred[user][referrer], "Already referred");
        
        hasReferred[user][referrer] = true;
        userReferrer[user] = referrer;
        referralsByUser[referrer].push(user);
        
        ReferrerInfo storage info = referrerData[referrer];
        info.totalReferred++;
        
        if (info.referrer == address(0)) {
            info.referrer = referrer;
            info.active = true;
            activeReferrers++;
        }
        
        _updateTier(referrer);
        
        reward = _calculateReward(referrer);
        
        if (reward > 0) {
            IUSDTZ(usdtzToken).mint(referrer, reward);
            info.totalEarnings += reward;
            totalRewardsDistributed += reward;
        }
        
        totalReferrals++;
        
        emit ReferrerRegistered(user, referrer);
        emit ReferralRewarded(referrer, user, reward, info.tier);
        
        return reward;
    }
    
    function _calculateReward(address referrer) internal view returns (uint256) {
        ReferrerInfo storage info = referrerData[referrer];
        uint256 tier = _getTier(info.totalReferred);
        
        uint256 baseReward = rewardsPerReferral;
        uint256 tierBonus;
        
        if (tier >= TIER3_LEVEL) tierBonus = TIER3_REWARDS - BASE_REWARDS;
        else if (tier >= TIER2_LEVEL) tierBonus = TIER2_REWARDS - BASE_REWARDS;
        else if (tier >= TIER1_LEVEL) tierBonus = TIER1_REWARDS - BASE_REWARDS;
        
        return baseReward + tierBonus;
    }
    
    function _getTier(uint256 totalReferred) internal view returns (uint256) {
        if (totalReferred >= tier3Threshold) return TIER3_LEVEL;
        if (totalReferred >= tier2Threshold) return TIER2_LEVEL;
        if (totalReferred >= tier1Threshold) return TIER1_LEVEL;
        return 0;
    }
    
    function _updateTier(address referrer) internal {
        ReferrerInfo storage info = referrerData[referrer];
        uint256 newTier = _getTier(info.totalReferred);
        
        if (newTier > info.tier) {
            uint256 oldTier = info.tier;
            info.tier = newTier;
            emit TierUpgraded(referrer, oldTier, newTier);
        }
    }
    
    function getReferralStats(address referrer) external view returns (
        uint256 totalReferred,
        uint256 totalEarnings,
        uint256 tier,
        uint256 tierRewards
    ) {
        ReferrerInfo storage info = referrerData[referrer];
        return (
            info.totalReferred,
            info.totalEarnings,
            info.tier,
            _getTierReward(info.tier)
        );
    }
    
    function _getTierReward(uint256 tier) internal view returns (uint256) {
        if (tier >= TIER3_LEVEL) return TIER3_REWARDS;
        if (tier >= TIER2_LEVEL) return TIER2_REWARDS;
        if (tier >= TIER1_LEVEL) return TIER1_REWARDS;
        return BASE_REWARDS;
    }
    
    function setRewardsConfig(
        uint256 base,
        uint256 tier1,
        uint256 tier2,
        uint256 tier3
    ) external onlyOwner {
        rewardsPerReferral = base;
        tier1Threshold = tier1;
        tier2Threshold = tier2;
        tier3Threshold = tier3;
        emit RewardsConfigUpdated(base, tier1, tier2, tier3);
    }
    
    function getUserReferralInfo(address user) external view returns (
        address referrer,
        uint256 referrerCount,
        bool hasValidReferrer
    ) {
        return (
            userReferrer[user],
            referralsByUser[user].length,
            userReferrer[user] != address(0)
        );
    }
    
    function getStats() external view returns (
        uint256 _totalReferrals,
        uint256 _totalRewardsDistributed,
        uint256 _activeReferrers
    ) {
        return (
            totalReferrals,
            totalRewardsDistributed,
            activeReferrers
        );
    }
}

