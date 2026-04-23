// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUSDTZ {
    function mint(address to, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

contract FiatOnRamp is Ownable, ReentrancyGuard {
    
    uint256 public constant MIN_PURCHASE = 10e18;
    uint256 public constant MAX_PURCHASE = 50000e18;
    uint256 public FEE_BPS = 50;
    
    address public usdtzToken;
    address public wbnbAddress;
    address public usdtAddress;
    
    address public priceOracle;
    address public treasury;
    address public partnerAddress;
    
    uint256 public totalPurchased;
    uint256 public totalVolumeUSD;
    uint256 public purchaseCounter;
    
    bool public active = true;
    bool public kycRequired = true;
    
    mapping(address => uint256) public userPurchases;
    mapping(address => uint256) public userVolumeUSD;
    mapping(address => bool) public kycVerified;
    mapping(address => bool) public partners;
    
    struct Purchase {
        address user;
        uint256 amount;
        uint256 amountUSD;
        uint256 fee;
        uint256 timestamp;
        bool completed;
    }
    
    mapping(uint256 => Purchase) public purchases;
    
    event PurchaseRequested(
        address indexed user,
        uint256 indexed purchaseId,
        uint256 usdtzAmount,
        uint256 usdAmount,
        address indexed partner
    );
    event PurchaseCompleted(
        address indexed user,
        uint256 indexed purchaseId,
        uint256 usdtzAmount
    );
    event PurchaseCancelled(uint256 indexed purchaseId);
    event KYCVerified(address indexed user);
    event PartnerUpdated(address indexed partner, bool status);
    event FeeUpdated(uint256 newFeeBps);
    event PriceOracleUpdated(address newOracle);
    
    constructor(
        address _usdtz,
        address _wbnb,
        address _usdt,
        address _treasury
    ) {
        usdtzToken = _usdtz;
        wbnbAddress = _wbnb;
        usdtAddress = _usdt;
        treasury = _treasury;
    }
    
    function getBNBPrice() public view returns (uint256) {
        require(priceOracle != address(0), "Price oracle not set");
        (, int256 price, , , ) = AggregatorV3Interface(priceOracle).latestRoundData();
        return uint256(price);
    }
    
    function calculateUSDTZAmount(uint256 usdAmount) public view returns (uint256) {
        uint256 bnbPrice = getBNBPrice();
        uint256 bnbAmount = (usdAmount * 1e18) / bnbPrice;
        return bnbAmount;
    }
    
    function purchaseUSDTZ(uint256 usdAmount, address partner) 
        external 
        nonReentrant 
        returns (uint256 purchaseId) 
    {
        require(active, "Purchases disabled");
        require(usdAmount >= MIN_PURCHASE, "Below minimum purchase");
        require(usdAmount <= MAX_PURCHASE, "Above maximum purchase");
        
        if (kycRequired) {
            require(kycVerified[msg.sender], "KYC required");
        }
        
        uint256 fee = (usdAmount * FEE_BPS) / 10000;
        uint256 netUSD = usdAmount - fee;
        
        uint256 usdtzAmount = calculateUSDTZAmount(netUSD);
        require(usdtzAmount > 0, "Invalid amount");
        
        purchaseId = purchaseCounter++;
        
        purchases[purchaseId] = Purchase({
            user: msg.sender,
            amount: usdtzAmount,
            amountUSD: usdAmount,
            fee: fee,
            timestamp: block.timestamp,
            completed: false
        });
        
        if (partner != address(0) && partners[partner]) {
            partnerAddress = partner;
        }
        
        emit PurchaseRequested(msg.sender, purchaseId, usdtzAmount, usdAmount, partnerAddress);
        
        return purchaseId;
    }
    
    function completePurchase(uint256 purchaseId) external onlyOwner nonReentrant {
        Purchase storage purchase = purchases[purchaseId];
        require(!purchase.completed, "Already completed");
        require(purchase.user != address(0), "Purchase not found");
        
        purchase.completed = true;
        
        IUSDTZ(usdtzToken).mint(purchase.user, purchase.amount);
        
        userPurchases[purchase.user]++;
        userVolumeUSD[purchase.user] += purchase.amountUSD;
        totalPurchased += purchase.amount;
        totalVolumeUSD += purchase.amountUSD;
        
        emit PurchaseCompleted(purchase.user, purchaseId, purchase.amount);
    }
    
    function cancelPurchase(uint256 purchaseId) external onlyOwner nonReentrant {
        Purchase storage purchase = purchases[purchaseId];
        require(!purchase.completed, "Already completed");
        purchase.completed = true;
        emit PurchaseCancelled(purchaseId);
    }
    
    function verifyKYC(address user) external onlyOwner {
        kycVerified[user] = true;
        emit KYCVerified(user);
    }
    
    function revokeKYC(address user) external onlyOwner {
        kycVerified[user] = false;
    }
    
    function setPartner(address partner, bool status) external onlyOwner {
        partners[partner] = status;
        emit PartnerUpdated(partner, status);
    }
    
    function setFee(uint256 feeBps) external onlyOwner {
        require(feeBps <= 500, "Fee too high");
        FEE_BPS = feeBps;
        emit FeeUpdated(feeBps);
    }
    
    function setPriceOracle(address oracle) external onlyOwner {
        priceOracle = oracle;
        emit PriceOracleUpdated(oracle);
    }
    
    function setKYCRequired(bool required) external onlyOwner {
        kycRequired = required;
    }
    
    function setActive(bool _active) external onlyOwner {
        active = _active;
    }
    
    function withdrawETH(address to, uint256 amount) external onlyOwner {
        require(payable(to).send(amount), "Transfer failed");
    }
    
    function withdrawERC20(address token, address to, uint256 amount) external onlyOwner {
        require(IERC20(token).transfer(to, amount), "Transfer failed");
    }
    
    function getUserStats(address user) external view returns (
        uint256 purchaseCount,
        uint256 totalVolume,
        bool isKYCVerified
    ) {
        return (
            userPurchases[user],
            userVolumeUSD[user],
            kycVerified[user]
        );
    }
    
    function getPurchaseInfo(uint256 purchaseId) external view returns (
        address user,
        uint256 amount,
        uint256 amountUSD,
        uint256 fee,
        uint256 timestamp,
        bool completed
    ) {
        Purchase storage p = purchases[purchaseId];
        return (p.user, p.amount, p.amountUSD, p.fee, p.timestamp, p.completed);
    }
    
    function getStats() external view returns (
        uint256 _totalPurchased,
        uint256 _totalVolumeUSD,
        uint256 _purchaseCount,
        bool _active,
        uint256 _feeBps
    ) {
        return (
            totalPurchased,
            totalVolumeUSD,
            purchaseCounter,
            active,
            FEE_BPS
        );
    }
}