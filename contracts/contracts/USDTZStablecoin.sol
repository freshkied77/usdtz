// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

interface IPoolManager {
    function getCollateralRatio() external view returns (uint256);
    function getMintFee() external view returns (uint256);
    function getRedeemFee() external view returns (uint256);
    function getLiquidationThreshold() external view returns (uint256);
    function getProtocolCollateralValue() external view returns (uint256);
}

interface IPriceOracle {
    function getPrice(address token) external view returns (uint256);
    function getLatestAnswer() external view returns (int256);
}

contract USDTZ is ERC20, ERC20Burnable, Ownable, ReentrancyGuard {
    
    uint256 public constant TARGET_PRICE = 1e18;
    uint256 public constant PRICE_FEED_INTERVAL = 15 minutes;
    
    struct MintParams {
        uint256 amount;
        address token;
        uint256 minOut;
    }
    
    struct RedeemParams {
        uint256 amount;
        address token;
        uint256 minOut;
    }
    
    mapping(address => uint256) public collateralDeposits;
    mapping(address => uint256) public debtPositions;
    mapping(address => uint256) public lastRedemptions;
    
    uint256 public immutable minimumCollateralRatio = 150e16;
    uint256 public immutable liquidationThreshold = 120e16;
    uint256 public immutable mintFeeBps = 25;
    uint256 public immutable redeemFeeBps = 25;
    uint256 public immutable protocolFeeBps = 10;
    
    address public poolManager;
    address public priceOracle;
    address public wbnbAddress;
    address public treasuryAddress;
    
    uint256 public totalCollateralDeposited;
    uint256 public totalDebtCreated;
    uint256 public lastAdjustmentTimestamp;
    uint256 public rebaseCounter;
    
    uint256 private constant TARGET_RATIO = 150e16;
    uint256 private constant UPPER_TARGET_RATIO = 200e16;
    uint256 private constant LOWER_TARGET_RATIO = 125e16;
    
    bool public emergencyShutdown;
    
    event Mint(address indexed user, uint256 amount, uint256 fee);
    event Redeem(address indexed user, uint256 amount, uint256 fee);
    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount, uint256 released);
    event Liquidation(address indexed user, uint256 debtRepaid, uint256 collateralSeized);
    event Rebase(int256 delta, uint256 newTotalSupply);
    event EmergencyShutdownActivated();
    event PriceRecovery(uint256 price, uint256 deviation);
    
    modifier whenNotShutdown() {
        require(!emergencyShutdown, "Emergency shutdown active");
        _;
    }
    
    constructor(address _priceOracle, address _wbnb, address _treasury) ERC20("USDTZ", "USDTZ") {
        priceOracle = _priceOracle;
        wbnbAddress = _wbnb;
        treasuryAddress = _treasury;
        emergencyShutdown = false;
    }
    
    function setPoolManager(address _manager) external onlyOwner {
        poolManager = _manager;
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        treasuryAddress = _treasury;
    }
    
    function getCurrentPrice() public view returns (uint256) {
        if (priceOracle != address(0)) {
            return uint256(IPriceOracle(priceOracle).getLatestAnswer()) * 1e10;
        }
        return TARGET_PRICE;
    }
    
    function getGlobalCollateralRatio() public view returns (uint256) {
        if (totalDebtCreated == 0) return 0;
        return (totalCollateralDeposited * 1e18) / totalDebtCreated;
    }
    
    function mint(uint256 amount, address token, uint256 minOut) external nonReentrant whenNotShutdown {
        require(amount > 0, "Amount must be positive");
        uint256 price = getCurrentPrice();
        
        uint256 fee = (amount * mintFeeBps) / 10000;
        uint256 mintAmount = amount - fee;
        
        uint256 requiredCollateral = (mintAmount * price) / TARGET_PRICE;
        requiredCollateral = (requiredCollateral * TARGET_RATIO) / 1e18;
        
        require(IERC20(token).balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        collateralDeposits[msg.sender] += requiredCollateral;
        debtPositions[msg.sender] += mintAmount;
        
        _mint(msg.sender, mintAmount);
        
        totalCollateralDeposited += requiredCollateral;
        totalDebtCreated += mintAmount;
        
        lastAdjustmentTimestamp = block.timestamp;
        
        emit Mint(msg.sender, mintAmount, fee);
    }
    
    function redeem(uint256 amount, address token, uint256 minOut) external nonReentrant whenNotShutdown {
        require(amount > 0, "Amount must be positive");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        uint256 price = getCurrentPrice();
        
        uint256 fee = (amount * redeemFeeBps) / 10000;
        uint256 redeemAmount = amount - fee;
        
        uint256 debt = debtPositions[msg.sender];
        require(debt >= redeemAmount, "Exceeds debt position");
        
        uint256 collateralUsed = (redeemAmount * price) / TARGET_PRICE;
        collateralUsed = (collateralUsed * TARGET_RATIO) / 1e18;
        
        require(collateralDeposits[msg.sender] >= collateralUsed, "Insufficient collateral");
        
        _burn(msg.sender, amount);
        
        collateralDeposits[msg.sender] -= collateralUsed;
        debtPositions[msg.sender] -= redeemAmount;
        
        totalCollateralDeposited -= collateralUsed;
        totalDebtCreated -= redeemAmount;
        
        uint256 userShare = (collateralUsed * 9000) / 10000;
        uint256 protocolShare = collateralUsed - userShare;
        
        require(IERC20(token).transfer(msg.sender, userShare), "Transfer failed");
        if (protocolShare > 0) {
            require(IERC20(token).transfer(treasuryAddress, protocolShare), "Treasury transfer failed");
        }
        
        lastAdjustmentTimestamp = block.timestamp;
        
        emit Redeem(msg.sender, redeemAmount, fee);
    }
    
    function liquidate(address user, uint256 debtToRepay) external nonReentrant whenNotShutdown {
        require(debtToRepay > 0, "Debt must be positive");
        
        uint256 price = getCurrentPrice();
        uint256 positionDebt = debtPositions[user];
        uint256 positionCollateral = collateralDeposits[user];
        
        uint256 collateralRatio = (positionCollateral * 1e18) / positionDebt;
        require(collateralRatio < liquidationThreshold, "Position not liquidatable");
        
        uint256 liquidationBonus = 110e16;
        uint256 maxDebtToCover = (positionCollateral * 1e18) / liquidationBonus;
        uint256 actualDebtToCover = debtToRepay > maxDebtToCover ? maxDebtToCover : debtToRepay;
        
        uint256 collateralToSeize = (actualDebtToCover * liquidationBonus) / 1e18;
        
        debtPositions[user] -= actualDebtToCover;
        collateralDeposits[user] -= collateralToSeize;
        
        _burn(msg.sender, actualDebtToCover);
        
        totalDebtCreated -= actualDebtToCover;
        totalCollateralDeposited -= collateralToSeize;
        
        emit Liquidation(user, actualDebtToCover, collateralToSeize);
    }
    
    function rebase() external onlyOwner {
        uint256 price = getCurrentPrice();
        int256 deviation = int256(price) - int256(TARGET_PRICE);
        uint256 absDeviation = deviation < 0 ? uint256(-deviation) : uint256(deviation);
        
        if (absDeviation > (TARGET_PRICE / 100)) {
            int256 supplyAdjustment = int256(totalSupply()) * deviation / int256(TARGET_PRICE);
            
            if (supplyAdjustment > 0) {
                _mint(address(this), uint256(supplyAdjustment));
            } else {
                _burn(address(this), uint256(-supplyAdjustment));
            }
            
            rebaseCounter++;
            emit Rebase(supplyAdjustment, totalSupply());
            emit PriceRecovery(price, absDeviation);
        }
    }
    
    function activateEmergencyShutdown() external onlyOwner {
        emergencyShutdown = true;
        emit EmergencyShutdownActivated();
    }
    
    function getPositionInfo(address user) external view returns (uint256 collateral, uint256 debt, uint256 ratio) {
        collateral = collateralDeposits[user];
        debt = debtPositions[user];
        if (debt > 0) {
            ratio = (collateral * 1e18) / debt;
        }
    }
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(emergencyShutdown, "Not in emergency");
        IERC20(token).transfer(owner(), amount);
    }
}