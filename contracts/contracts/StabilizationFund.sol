// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUSDTZ {
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function totalSupply() external view returns (uint256);
}

interface IPancakeSwapPair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
    function sync() external;
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
}

contract StabilizationFund is Ownable, ReentrancyGuard {
    
    uint256 public constant TARGET_PRICE = 1e18;
    uint256 public constant ACCEPTABLE_BAND_HIGH = 1005e14;
    uint256 public constant ACCEPTABLE_BAND_LOW = 995e14;
    uint256 public constant REBALANCE_THRESHOLD = 1000e18;
    
    address public usdtzToken;
    address public usdtToken;
    address public wbnbToken;
    address public pancakePair;
    address public treasury;
    address public liquidityManager;
    
    uint256 public bufferUSDT;
    uint256 public bufferUSDTZ;
    uint256 public lastRebalanceTime;
    uint256 public rebalanceCounter;
    uint256 public rebalanceDelay = 5 minutes;
    
    uint256 public highBandBreaches;
    uint256 public lowBandBreaches;
    uint256 public successfulRebalances;
    uint256 public failedRebalances;
    
    bool public active = true;
    bool public emergencyShutdown;
    bool public autoRebalanceEnabled = true;
    
    uint256 public minBufferUSDT = 10000e18;
    uint256 public minBufferUSDTZ = 5000e18;
    uint256 public maxRebalanceAmount = 100000e18;
    uint256 public rebalanceSlippageTolerance = 50;
    
    mapping(address => bool) public authorizedSpenders;
    mapping(address => uint256) public lastTradeTimestamp;
    
    uint256 public priceAverageWindow = 15 minutes;
    uint256[] public priceHistory;
    uint256 public priceHistoryIndex;
    uint256 public currentPriceAverage;
    
    event PegDeviationDetected(uint256 currentPrice, uint256 targetPrice, uint256 deviation, string direction);
    event RebalanceExecuted(uint256 amount, bool isBuy, uint256 newPrice, uint256 priceAfter);
    event BufferUpdated(uint256 newBalance, string tokenType);
    event EmergencyShutdownActivated();
    event ReservesDeployed(uint256 amount, string purpose);
    event AutoRebalanceToggled(bool enabled);
    event LiquidityManagerUpdated(address newManager);
    event PriceAverageUpdated(uint256 average, uint256 currentPrice);
    event SlippageExceeded(uint256 expected, uint256 actual, string operation);
    
    modifier onlyAuthorized() {
        require(owner() == msg.sender || authorizedSpenders[msg.sender], "Not authorized");
        _;
    }
    
    constructor(
        address _usdtz,
        address _usdt,
        address _wbnb,
        address _pancakePair,
        address _treasury
    ) {
        usdtzToken = _usdtz;
        usdtToken = _usdt;
        wbnbToken = _wbnb;
        pancakePair = _pancakePair;
        treasury = _treasury;
        lastRebalanceTime = block.timestamp;
        priceHistory = new uint256[](24);
    }
    
    function setPancakePair(address _pair) external onlyOwner {
        require(_pair != address(0), "Invalid pair");
        pancakePair = _pair;
    }

    function setLiquidityManager(address _manager) external onlyOwner {
        liquidityManager = _manager;
        emit LiquidityManagerUpdated(_manager);
    }
    
    function setAutoRebalanceEnabled(bool _enabled) external onlyOwner {
        autoRebalanceEnabled = _enabled;
        emit AutoRebalanceToggled(_enabled);
    }
    
    function setRebalanceParams(
        uint256 _minBufferUSDT,
        uint256 _minBufferUSDTZ,
        uint256 _maxRebalanceAmount,
        uint256 _slippageTolerance
    ) external onlyOwner {
        minBufferUSDT = _minBufferUSDT;
        minBufferUSDTZ = _minBufferUSDTZ;
        maxRebalanceAmount = _maxRebalanceAmount;
        rebalanceSlippageTolerance = _slippageTolerance;
    }
    
    function getCurrentPrice() public view returns (uint256) {
        (uint112 reserve0, uint112 reserve1, ) = IPancakeSwapPair(pancakePair).getReserves();
        address token0 = IPancakeSwapPair(pancakePair).token0();
        
        uint256 usdtzReserve;
        uint256 usdtReserve;
        
        if (token0 == usdtzToken) {
            usdtzReserve = reserve0;
            usdtReserve = reserve1;
        } else {
            usdtzReserve = reserve1;
            usdtReserve = reserve0;
        }
        
        if (usdtzReserve == 0) return TARGET_PRICE;
        return (usdtReserve * TARGET_PRICE) / usdtzReserve;
    }
    
    function getMovingAveragePrice() public view returns (uint256) {
        if (priceHistory.length == 0) return getCurrentPrice();
        
        uint256 sum = 0;
        uint256 count = 0;
        
        for (uint256 i = 0; i < priceHistory.length; i++) {
            if (priceHistory[i] > 0) {
                sum += priceHistory[i];
                count++;
            }
        }
        
        if (count == 0) return getCurrentPrice();
        return sum / count;
    }
    
    function updatePriceHistory() internal {
        uint256 currentPrice = getCurrentPrice();
        priceHistory[priceHistoryIndex] = currentPrice;
        priceHistoryIndex = (priceHistoryIndex + 1) % priceHistory.length;
        
        uint256 sum = 0;
        uint256 count = 0;
        for (uint256 i = 0; i < priceHistory.length; i++) {
            if (priceHistory[i] > 0) {
                sum += priceHistory[i];
                count++;
            }
        }
        if (count > 0) {
            currentPriceAverage = sum / count;
            emit PriceAverageUpdated(currentPriceAverage, currentPrice);
        }
    }
    
    function checkPegStatus() public view returns (
        string memory status,
        uint256 currentPrice,
        uint256 deviation,
        uint256 bufferBalanceUSDT,
        uint256 bufferBalanceUSDTZ
    ) {
        currentPrice = getCurrentPrice();
        bufferBalanceUSDT = bufferUSDT;
        bufferBalanceUSDTZ = bufferUSDTZ;
        
        if (currentPrice >= ACCEPTABLE_BAND_LOW && currentPrice <= ACCEPTABLE_BAND_HIGH) {
            status = "Peg Stable";
            deviation = 0;
        } else if (currentPrice > ACCEPTABLE_BAND_HIGH) {
            status = "Above Peg - Overvalued";
            deviation = currentPrice - ACCEPTABLE_BAND_HIGH;
        } else {
            status = "Below Peg - Undervalued";
            deviation = ACCEPTABLE_BAND_LOW - currentPrice;
        }
    }
    
    function executeTrade(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut) internal returns (bool success, uint256 amountOut) {
        (uint112 reserve0, uint112 reserve1, ) = IPancakeSwapPair(pancakePair).getReserves();
        address token0 = IPancakeSwapPair(pancakePair).token0();
        
        uint256 reserveIn;
        uint256 reserveOut;
        bool tokenInIsZero;
        
        if (token0 == tokenIn) {
            reserveIn = reserve0;
            reserveOut = reserve1;
            tokenInIsZero = true;
        } else {
            reserveIn = reserve1;
            reserveOut = reserve0;
            tokenInIsZero = false;
        }
        
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        uint256 amountOutWithFee = numerator / denominator;
        
        require(amountOutWithFee >= minOut, "Slippage tolerance exceeded");
        
        try IPancakeSwapPair(pancakePair).swap(
            tokenInIsZero ? amountOutWithFee : 0,
            tokenInIsZero ? 0 : amountOutWithFee,
            address(this),
            new bytes(0)
        ) {
            return (true, amountOutWithFee);
        } catch {
            return (false, 0);
        }
    }
    
    function rebalance() external onlyAuthorized nonReentrant {
        require(active && !emergencyShutdown, "Stabilization not active");
        require(autoRebalanceEnabled, "Auto rebalance disabled");
        require(block.timestamp - lastRebalanceTime >= rebalanceDelay, "Too soon since last rebalance");
        
        updatePriceHistory();
        
        uint256 currentPrice = getCurrentPrice();
        uint256 avgPrice = getMovingAveragePrice();
        
        if (avgPrice > 0) {
            uint256 deviationFromAvg = currentPrice > avgPrice 
                ? currentPrice - avgPrice 
                : avgPrice - currentPrice;
            uint256 avgDeviationPercent = (deviationFromAvg * 100) / avgPrice;
            
            if (avgDeviationPercent > 100) {
                failedRebalances++;
                emit PegDeviationDetected(currentPrice, TARGET_PRICE, deviationFromAvg, "High Volatility");
                return;
            }
        }
        
        uint256 deviation = currentPrice > TARGET_PRICE 
            ? currentPrice - TARGET_PRICE 
            : TARGET_PRICE - currentPrice;
        
        if (deviation < 1e14) {
            return;
        }
        
        if (currentPrice > ACCEPTABLE_BAND_HIGH) {
            _buyBackUSDTZ(deviation, currentPrice);
        } else if (currentPrice < ACCEPTABLE_BAND_LOW) {
            _sellToSupportPeg(deviation, currentPrice);
        }
        
        lastRebalanceTime = block.timestamp;
    }
    
    function _buyBackUSDTZ(uint256 deviation, uint256 currentPrice) internal {
        // Price is ABOVE peg. USDTZ is overvalued.
        // Strategy: Sell USDTZ into the pool to bring price down.
        uint256 usdtzBalance = IERC20(usdtzToken).balanceOf(address(this));

        if (usdtzBalance < minBufferUSDTZ / 10) {
            highBandBreaches++;
            emit PegDeviationDetected(currentPrice, TARGET_PRICE, deviation, "Above Peg - Insufficient USDTZ");
            return;
        }

        uint256 deviationPercent = (deviation * 100) / TARGET_PRICE;
        uint256 baseAmount = usdtzBalance / 10;

        uint256 multiplier = deviationPercent / 5;
        if (multiplier < 1) multiplier = 1;
        if (multiplier > 20) multiplier = 20;

        uint256 sellAmount = (baseAmount * multiplier) / 10;

        if (sellAmount > maxRebalanceAmount) sellAmount = maxRebalanceAmount;
        if (sellAmount > usdtzBalance) sellAmount = usdtzBalance;

        if (sellAmount < REBALANCE_THRESHOLD / 10) {
            highBandBreaches++;
            emit PegDeviationDetected(currentPrice, TARGET_PRICE, deviation, "Below Minimum Rebalance");
            return;
        }

        uint256 priceBefore = currentPrice;

        // Calculate minimum output with slippage tolerance
        uint256 minOut = (sellAmount * (10000 - rebalanceSlippageTolerance)) / 10000;

        // Transfer USDTZ to the pair and execute swap
        IERC20(usdtzToken).transfer(address(pancakePair), sellAmount);
        (bool success, uint256 amountOut) = executeTrade(usdtzToken, usdtToken, sellAmount, minOut);

        if (!success) {
            // Sync the pair to account for the transferred tokens
            IPancakeSwapPair(pancakePair).sync();
            failedRebalances++;
            emit SlippageExceeded(minOut, 0, "buyback");
            return;
        }

        // Track the USDT received in buffer
        bufferUSDT += amountOut;
        bufferUSDTZ -= sellAmount;

        successfulRebalances++;
        rebalanceCounter++;
        uint256 newPrice = getCurrentPrice();

        emit RebalanceExecuted(sellAmount, true, priceBefore, newPrice);
        emit ReservesDeployed(sellAmount, "USDTZ sold - above peg");
    }
    
    function _sellToSupportPeg(uint256 deviation, uint256 currentPrice) internal {
        // Price is BELOW peg. USDTZ is undervalued.
        // Strategy: Buy USDTZ with USDT from the pool to bring price up.
        uint256 usdtBalance = IERC20(usdtToken).balanceOf(address(this));

        if (usdtBalance < minBufferUSDT / 10) {
            lowBandBreaches++;
            emit PegDeviationDetected(currentPrice, TARGET_PRICE, deviation, "Below Peg - Insufficient USDT");
            return;
        }

        uint256 deviationPercent = (deviation * 100) / TARGET_PRICE;
        uint256 baseAmount = usdtBalance / 10;

        uint256 multiplier = deviationPercent / 5;
        if (multiplier < 1) multiplier = 1;
        if (multiplier > 20) multiplier = 20;

        uint256 buyAmount = (baseAmount * multiplier) / 10;

        if (buyAmount > maxRebalanceAmount) buyAmount = maxRebalanceAmount;
        if (buyAmount > usdtBalance) buyAmount = usdtBalance;

        if (buyAmount < REBALANCE_THRESHOLD / 10) {
            lowBandBreaches++;
            emit PegDeviationDetected(currentPrice, TARGET_PRICE, deviation, "Below Minimum Rebalance");
            return;
        }

        uint256 priceBefore = currentPrice;

        // Calculate minimum USDTZ output with slippage tolerance
        uint256 minOut = (buyAmount * (10000 - rebalanceSlippageTolerance)) / 10000;

        // Transfer USDT to pair and swap for USDTZ
        IERC20(usdtToken).transfer(address(pancakePair), buyAmount);
        (bool success, uint256 amountOut) = executeTrade(usdtToken, usdtzToken, buyAmount, minOut);

        if (!success) {
            IPancakeSwapPair(pancakePair).sync();
            failedRebalances++;
            emit SlippageExceeded(minOut, 0, "peg-support");
            return;
        }

        // Track buffers
        bufferUSDT -= buyAmount;
        bufferUSDTZ += amountOut;

        successfulRebalances++;
        rebalanceCounter++;
        uint256 newPrice = getCurrentPrice();

        emit RebalanceExecuted(buyAmount, false, priceBefore, newPrice);
        emit ReservesDeployed(buyAmount, "USDT spent - below peg support");
    }
    
    function addLiquidityToPair(uint256 usdtAmount, uint256 usdtzAmount) external onlyOwner {
        require(!emergencyShutdown, "Emergency shutdown active");
        
        if (usdtAmount > 0) {
            require(IERC20(usdtToken).transferFrom(msg.sender, address(this), usdtAmount), "USDT transfer failed");
        }
        if (usdtzAmount > 0) {
            require(IERC20(usdtzToken).transferFrom(msg.sender, address(this), usdtzAmount), "USDTZ transfer failed");
        }
        
        uint256 totalAdded = usdtAmount + (usdtzAmount * TARGET_PRICE) / TARGET_PRICE;
        emit ReservesDeployed(totalAdded, "Liquidity addition to pair");
    }
    
    function depositBuffer(uint256 amount, address token) external onlyOwner {
        require(token == usdtToken || token == usdtzToken, "Unsupported token");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        if (token == usdtToken) {
            bufferUSDT += amount;
        } else {
            bufferUSDTZ += amount;
        }
        
        emit BufferUpdated(token == usdtToken ? bufferUSDT : bufferUSDTZ, token == usdtToken ? "USDT" : "USDTZ");
    }
    
    function withdrawBuffer(uint256 amount, address token, address to) external onlyOwner {
        require(!emergencyShutdown, "Emergency shutdown active");
        require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient balance");
        
        IERC20(token).transfer(to, amount);
        
        if (token == usdtToken) {
            bufferUSDT -= amount;
            emit BufferUpdated(bufferUSDT, "USDT");
        } else {
            bufferUSDTZ -= amount;
            emit BufferUpdated(bufferUSDTZ, "USDTZ");
        }
    }
    
    function activateEmergencyShutdown() external onlyOwner {
        emergencyShutdown = true;
        active = false;
        emit EmergencyShutdownActivated();
    }
    
    function setActive(bool _active) external onlyOwner {
        active = _active;
    }
    
    function setAuthorizedSpender(address spender, bool authorized) external onlyOwner {
        authorizedSpenders[spender] = authorized;
    }
    
    function setRebalanceDelay(uint256 _delay) external onlyOwner {
        require(_delay >= 1 minutes, "Delay too short");
        require(_delay <= 60 minutes, "Delay too long");
        rebalanceDelay = _delay;
    }
    
    function getStats() external view returns (
        uint256 _bufferUSDT,
        uint256 _bufferUSDTZ,
        uint256 _lastRebalance,
        uint256 _successfulRebalances,
        uint256 _highBandBreaches,
        uint256 _lowBandBreaches,
        uint256 _currentPrice,
        uint256 _movingAverage,
        bool _active,
        bool _emergencyShutdown
    ) {
        return (
            bufferUSDT,
            bufferUSDTZ,
            lastRebalanceTime,
            successfulRebalances,
            highBandBreaches,
            lowBandBreaches,
            getCurrentPrice(),
            getMovingAveragePrice(),
            active,
            emergencyShutdown
        );
    }
    
    receive() external payable {
        if (wbnbToken == address(0)) return;
        IWETH(wbnbToken).deposit{value: msg.value}();
    }
}

