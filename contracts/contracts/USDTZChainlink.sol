// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

interface IPoolManager {
    function getCollateralRatio() external view returns (uint256);
    function getMintFee() external view returns (uint256);
    function getRedeemFee() external view returns (uint256);
    function getLiquidationThreshold() external view returns (uint256);
    function getProtocolCollateralValue() external view returns (uint256);
}

interface IUniswapV2Pair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function sync() external;
}

contract USDTZChainlink is ERC20, ERC20Burnable, Ownable, ReentrancyGuard {
    
    uint256 public constant TARGET_PRICE = 1e18;
    uint256 public constant CHAINLINK_PRECISION = 1e8;
    uint256 public constant PRICE_FEED_PRECISION = 1e18;
    
    address public chainlinkPriceFeed;
    address public poolManager;
    address public treasuryAddress;
    address public wbnbAddress;
    address public pairAddress;
    
    uint256 public immutable minimumCollateralRatio = 150e16;
    uint256 public immutable liquidationThreshold = 120e16;
    uint256 public immutable mintFeeBps = 25;
    uint256 public immutable redeemFeeBps = 25;
    uint256 public immutable protocolFeeBps = 10;
    uint256 public constant TOTAL_SUPPLY = 1000000000e18;
    
    uint256 public totalCollateralDeposited;
    uint256 public totalDebtCreated;
    uint256 public lastAdjustmentTimestamp;
    uint256 public rebaseCounter;
    uint256 public lastRebaseTimestamp;
    uint256 public rebaseDelay = 15 minutes;
    
    bool public emergencyShutdown;
    bool public chainlinkEnabled = true;
    bool public autoRebaseEnabled = true;
    
    uint256 public rebaseUpperBound = 1005e14;
    uint256 public rebaseLowerBound = 995e14;
    uint256 public maxRebaseSupplyChange = 100e18;
    uint256 public rebaseStepSize = 50e18;
    
    uint256 public volatilityAccumulator;
    uint256 public lastVolatilityCheck;
    uint256 public volatilityThreshold = 5e16;
    uint256 public circuitBreakerCounter;
    uint256 public maxCircuitBreakerDuration = 30 minutes;
    uint256 public lastCircuitBreakerActivation;
    
    uint256 public totalRebases;
    int256 public cumulativeRebaseAdjustment;
    uint256 public lastPriceBeforeRebase;
    
    mapping(address => uint256) public collateralDeposits;
    mapping(address => uint256) public debtPositions;
    mapping(address => uint256) public lastRedemptions;
    mapping(address => bool) public authorizedRebasers;
    
    event ChainlinkPriceUpdated(int256 price, uint256 timestamp);
    event Mint(address indexed user, uint256 amount, uint256 fee);
    event Redeem(address indexed user, uint256 amount, uint256 fee);
    event Liquidation(address indexed user, uint256 debtRepaid, uint256 collateralSeized);
    event Rebase(int256 delta, uint256 newTotalSupply, uint256 priceAfter, uint256 deviation);
    event EmergencyShutdownActivated();
    event ChainlinkFeedChanged(address newFeed);
    event AutoRebaseToggled(bool enabled);
    event CircuitBreakerActivated(uint256 duration, uint256 reason);
    event CircuitBreakerReset();
    event PairAddressSet(address pair);
    event AuthorizedRebaserSet(address rebaser, bool authorized);
    event RebaseParamsUpdated(uint256 upperBound, uint256 lowerBound, uint256 maxChange, uint256 stepSize);
    
    modifier whenNotShutdown() {
        require(!emergencyShutdown, "Emergency shutdown active");
        _;
    }
    
    modifier whenNotCircuitBroken() {
        require(!isCircuitBroken(), "Circuit breaker active");
        _;
    }
    
    constructor(
        address _chainlinkPriceFeed,
        address _wbnb,
        address _treasury
    ) ERC20("USDTZ", "USDTZ") {
        chainlinkPriceFeed = _chainlinkPriceFeed;
        wbnbAddress = _wbnb;
        treasuryAddress = _treasury;
        emergencyShutdown = false;
        lastVolatilityCheck = block.timestamp;
        lastRebaseTimestamp = block.timestamp;
        _mint(msg.sender, TOTAL_SUPPLY);
    }
    
    function setChainlinkPriceFeed(address _priceFeed) external onlyOwner {
        chainlinkPriceFeed = _priceFeed;
        emit ChainlinkFeedChanged(_priceFeed);
    }
    
    function setPoolManager(address _manager) external onlyOwner {
        poolManager = _manager;
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        treasuryAddress = _treasury;
    }
    
    function setChainlinkEnabled(bool _enabled) external onlyOwner {
        chainlinkEnabled = _enabled;
    }
    
    function setPairAddress(address _pair) external onlyOwner {
        pairAddress = _pair;
        emit PairAddressSet(_pair);
    }
    
    function setAutoRebaseEnabled(bool _enabled) external onlyOwner {
        autoRebaseEnabled = _enabled;
        emit AutoRebaseToggled(_enabled);
    }
    
    function setRebaseParams(
        uint256 _upperBound,
        uint256 _lowerBound,
        uint256 _maxChange,
        uint256 _stepSize
    ) external onlyOwner {
        require(_upperBound > _lowerBound, "Invalid bounds");
        require(_maxChange >= _stepSize, "Invalid change params");
        rebaseUpperBound = _upperBound;
        rebaseLowerBound = _lowerBound;
        maxRebaseSupplyChange = _maxChange;
        rebaseStepSize = _stepSize;
        emit RebaseParamsUpdated(_upperBound, _lowerBound, _maxChange, _stepSize);
    }
    
    function setAuthorizedRebaser(address _rebaser, bool _authorized) external onlyOwner {
        authorizedRebasers[_rebaser] = _authorized;
        emit AuthorizedRebaserSet(_rebaser, _authorized);
    }
    
    function getChainlinkPrice() public view returns (uint256) {
        require(chainlinkPriceFeed != address(0), "Price feed not set");
        
        (, int256 price, , uint256 updatedAt, ) = AggregatorV3Interface(chainlinkPriceFeed).latestRoundData();
        
        require(price > 0, "Invalid price");
        require(block.timestamp - updatedAt <= 1 hours, "Price stale");
        
        return uint256(price) * 1e10;
    }
    
    function getCurrentPrice() public view returns (uint256) {
        if (chainlinkEnabled && chainlinkPriceFeed != address(0)) {
            return getChainlinkPrice();
        }
        return TARGET_PRICE;
    }
    
    function getMarketPrice() public view returns (uint256) {
        if (pairAddress == address(0)) {
            return getCurrentPrice();
        }
        
        (uint112 reserve0, uint112 reserve1, ) = IUniswapV2Pair(pairAddress).getReserves();
        address token0 = IUniswapV2Pair(pairAddress).token0();
        
        uint256 usdtzReserve;
        uint256 stableReserve;
        
        if (token0 == address(this)) {
            usdtzReserve = reserve0;
            stableReserve = reserve1;
        } else {
            usdtzReserve = reserve1;
            stableReserve = reserve0;
        }
        
        if (usdtzReserve == 0 || stableReserve == 0) {
            return getCurrentPrice();
        }
        
        return (stableReserve * TARGET_PRICE) / usdtzReserve;
    }
    
    function getGlobalCollateralRatio() public view returns (uint256) {
        if (totalDebtCreated == 0) return 0;
        return (totalCollateralDeposited * 1e18) / totalDebtCreated;
    }
    
    function getPriceDeviation() public view returns (int256 deviation, bool isAbove) {
        uint256 marketPrice = getMarketPrice();
        if (marketPrice >= TARGET_PRICE) {
            deviation = int256(marketPrice) - int256(TARGET_PRICE);
            isAbove = true;
        } else {
            deviation = int256(TARGET_PRICE) - int256(marketPrice);
            isAbove = false;
        }
    }
    
    function isCircuitBroken() public view returns (bool) {
        if (circuitBreakerCounter == 0) return false;
        return block.timestamp - lastCircuitBreakerActivation < maxCircuitBreakerDuration;
    }
    
    function checkVolatility() internal {
        if (block.timestamp - lastVolatilityCheck < 1 hours) return;
        
        uint256 price1 = lastPriceBeforeRebase;
        uint256 price2 = getMarketPrice();
        
        if (price1 == 0) {
            lastVolatilityCheck = block.timestamp;
            return;
        }
        
        int256 vol = int256(price2) - int256(price1);
        if (vol < 0) vol = -vol;
        
        if (uint256(vol) > volatilityThreshold * price1 / 1e18) {
            if (circuitBreakerCounter == 0) {
                lastCircuitBreakerActivation = block.timestamp;
            }
            circuitBreakerCounter++;
        } else {
            if (circuitBreakerCounter > 0 && block.timestamp - lastCircuitBreakerActivation >= maxCircuitBreakerDuration) {
                circuitBreakerCounter = 0;
                emit CircuitBreakerReset();
            }
        }
        
        lastVolatilityCheck = block.timestamp;
    }
    
    function autoRebase() public whenNotShutdown whenNotCircuitBroken {
        require(autoRebaseEnabled, "Auto rebase disabled");
        require(msg.sender == owner() || authorizedRebasers[msg.sender], "Not authorized");
        require(block.timestamp - lastRebaseTimestamp >= rebaseDelay, "Too soon");
        
        uint256 marketPrice = getMarketPrice();
        lastPriceBeforeRebase = marketPrice;
        
        if (marketPrice >= rebaseUpperBound || marketPrice <= rebaseLowerBound) {
            _executeRebase(marketPrice);
        }
        
        checkVolatility();
    }
    
    function _executeRebase(uint256 marketPrice) internal {
        int256 deviation;
        bool isAbove;
        
        (deviation, isAbove) = getPriceDeviation();
        
        uint256 absDeviation = deviation < 0 ? uint256(-deviation) : uint256(deviation);
        
        uint256 baseSupplyChange = rebaseStepSize;
        
        if (absDeviation > TARGET_PRICE / 100) {
            uint256 deviationPercent = absDeviation * 100 / TARGET_PRICE;
            uint256 multiplier = deviationPercent / 2;
            if (multiplier < 1) multiplier = 1;
            if (multiplier > 10) multiplier = 10;
            
            baseSupplyChange = rebaseStepSize * multiplier;
        }
        
        uint256 maxAllowed = maxRebaseSupplyChange;
        if (totalSupply() > 1000000e18) {
            maxAllowed = totalSupply() / 1000;
        }
        
        if (baseSupplyChange > maxAllowed) {
            baseSupplyChange = maxAllowed;
        }
        
        int256 actualAdjustment;
        
        if (isAbove) {
            actualAdjustment = int256(baseSupplyChange);
            _mint(address(this), baseSupplyChange);
        } else {
            if (balanceOf(address(this)) < baseSupplyChange) {
                baseSupplyChange = balanceOf(address(this));
            }
            if (baseSupplyChange > 0) {
                actualAdjustment = -int256(baseSupplyChange);
                _burn(address(this), baseSupplyChange);
            }
        }
        
        lastRebaseTimestamp = block.timestamp;
        rebaseCounter++;
        totalRebases++;
        cumulativeRebaseAdjustment += actualAdjustment;
        
        if (pairAddress != address(0)) {
            IUniswapV2Pair(pairAddress).sync();
        }
        
        emit Rebase(actualAdjustment, totalSupply(), getMarketPrice(), absDeviation);
    }
    
    function rebase() external onlyOwner {
        require(!isCircuitBroken(), "Circuit breaker active");
        uint256 marketPrice = getMarketPrice();
        lastPriceBeforeRebase = marketPrice;
        _executeRebase(marketPrice);
    }
    
    function forceRebaseWithPrice(uint256 price) external onlyOwner {
        require(!emergencyShutdown, "Emergency shutdown active");
        lastPriceBeforeRebase = price;
        _executeRebase(price);
    }
    
    function mint(address to, uint256 amount) external onlyOwner whenNotShutdown {
        require(amount > 0, "Amount must be positive");
        uint256 fee = (amount * mintFeeBps) / 10000;
        uint256 mintAmount = amount - fee;

        if (fee > 0 && treasuryAddress != address(0)) {
            _mint(treasuryAddress, fee);
        }
        _mint(to, mintAmount);

        emit Mint(to, mintAmount, fee);
    }
    
    function burn(uint256 amount) public override {
        _burn(msg.sender, amount);
    }
    
    function mintCollateralized(uint256 amount, address token, uint256 minOut) external nonReentrant whenNotShutdown {
        require(amount > 0, "Amount must be positive");
        uint256 price = getCurrentPrice();
        
        uint256 fee = (amount * mintFeeBps) / 10000;
        uint256 mintAmount = amount - fee;
        
        uint256 requiredCollateral = (mintAmount * price) / TARGET_PRICE;
        requiredCollateral = (requiredCollateral * minimumCollateralRatio) / 1e18;
        
        require(IERC20(token).balanceOf(msg.sender) >= requiredCollateral, "Insufficient collateral");
        require(IERC20(token).transferFrom(msg.sender, address(this), requiredCollateral), "Transfer failed");
        
        collateralDeposits[msg.sender] += requiredCollateral;
        debtPositions[msg.sender] += mintAmount;
        
        _mint(msg.sender, mintAmount);
        
        totalCollateralDeposited += requiredCollateral;
        totalDebtCreated += mintAmount;
        
        lastAdjustmentTimestamp = block.timestamp;
        
        emit Mint(msg.sender, mintAmount, fee);
    }
    
    function redeemCollateralized(uint256 amount, address token, uint256 minOut) external nonReentrant whenNotShutdown {
        require(amount > 0, "Amount must be positive");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        uint256 price = getCurrentPrice();
        
        uint256 fee = (amount * redeemFeeBps) / 10000;
        uint256 redeemAmount = amount - fee;
        
        uint256 debt = debtPositions[msg.sender];
        require(debt >= redeemAmount, "Exceeds debt position");
        
        uint256 collateralUsed = (redeemAmount * price) / TARGET_PRICE;
        collateralUsed = (collateralUsed * minimumCollateralRatio) / 1e18;
        
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
    
    function liquidate(address user, uint256 debtToRepay, address collateralToken) external nonReentrant whenNotShutdown {
        require(debtToRepay > 0, "Debt must be positive");
        require(user != msg.sender, "Cannot liquidate self");

        uint256 positionDebt = debtPositions[user];
        uint256 positionCollateral = collateralDeposits[user];
        require(positionDebt > 0, "No debt position");

        uint256 collateralRatio = (positionCollateral * 1e18) / positionDebt;
        require(collateralRatio < liquidationThreshold, "Position not liquidatable");

        uint256 liquidationBonus = 110e16;
        uint256 maxDebtToCover = (positionCollateral * 1e18) / liquidationBonus;
        uint256 actualDebtToCover = debtToRepay > maxDebtToCover ? maxDebtToCover : debtToRepay;
        if (actualDebtToCover > positionDebt) actualDebtToCover = positionDebt;

        uint256 collateralToSeize = (actualDebtToCover * liquidationBonus) / 1e18;
        if (collateralToSeize > positionCollateral) collateralToSeize = positionCollateral;

        // Liquidator repays debt by burning their USDTZ
        require(balanceOf(msg.sender) >= actualDebtToCover, "Insufficient USDTZ to repay");
        _burn(msg.sender, actualDebtToCover);

        debtPositions[user] -= actualDebtToCover;
        collateralDeposits[user] -= collateralToSeize;
        totalDebtCreated -= actualDebtToCover;
        totalCollateralDeposited -= collateralToSeize;

        // Transfer seized collateral to liquidator as reward
        uint256 protocolCut = (collateralToSeize * protocolFeeBps) / 10000;
        uint256 liquidatorReward = collateralToSeize - protocolCut;

        require(IERC20(collateralToken).transfer(msg.sender, liquidatorReward), "Liquidator transfer failed");
        if (protocolCut > 0 && treasuryAddress != address(0)) {
            require(IERC20(collateralToken).transfer(treasuryAddress, protocolCut), "Treasury transfer failed");
        }

        emit Liquidation(user, actualDebtToCover, collateralToSeize);
    }
    
    function activateEmergencyShutdown() external onlyOwner {
        emergencyShutdown = true;
        emit EmergencyShutdownActivated();
    }
    
    function resetCircuitBreaker() external onlyOwner {
        circuitBreakerCounter = 0;
        emit CircuitBreakerReset();
    }
    
    function getPositionInfo(address user) external view returns (uint256 collateral, uint256 debt, uint256 ratio) {
        collateral = collateralDeposits[user];
        debt = debtPositions[user];
        if (debt > 0) {
            ratio = (collateral * 1e18) / debt;
        }
    }
    
    function getRebaseInfo() external view returns (
        uint256 _lastRebaseTimestamp,
        uint256 _rebaseCounter,
        uint256 _totalRebases,
        int256 _cumulativeAdjustment,
        bool _circuitBroken,
        uint256 _marketPrice,
        int256 _deviation
    ) {
        _lastRebaseTimestamp = lastRebaseTimestamp;
        _rebaseCounter = rebaseCounter;
        _totalRebases = totalRebases;
        _cumulativeAdjustment = cumulativeRebaseAdjustment;
        _circuitBroken = isCircuitBroken();
        _marketPrice = getMarketPrice();
        int256 dev;
        bool above;
        (dev, above) = getPriceDeviation();
        _deviation = dev;
    }
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(emergencyShutdown, "Not in emergency");
        IERC20(token).transfer(owner(), amount);
    }
    
    function getPriceData() external view returns (uint256 price, uint256 updatedAt, bool isStale) {
        if (chainlinkPriceFeed != address(0)) {
            (, int256 ans, , uint256 upAt, ) = AggregatorV3Interface(chainlinkPriceFeed).latestRoundData();
            price = uint256(ans) * 1e10;
            updatedAt = upAt;
            isStale = block.timestamp - upAt > 1 hours;
        } else {
            price = TARGET_PRICE;
            updatedAt = block.timestamp;
            isStale = false;
        }
    }
}

