// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IPancakeSwapRouter {
    function addLiquidity(
        address tokenA, address tokenB,
        uint256 amountADesired, uint256 amountBDesired,
        uint256 amountAMin, uint256 amountBMin,
        address to, uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    function addLiquidityETH(
        address token, uint256 amountTokenDesired,
        uint256 amountTokenMin, uint256 amountETHMin,
        address to, uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);

    function removeLiquidity(
        address tokenA, address tokenB,
        uint256 liquidity,
        uint256 amountAMin, uint256 amountBMin,
        address to, uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
}

interface IPancakeSwapFactory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
    function getPair(address tokenA, address tokenB) external view returns (address);
}

contract LiquidityManager is Ownable, ReentrancyGuard {
    
    struct TokenConfig {
        address tokenAddress;
        string name;
        uint256 weight;
        uint256 targetAllocation;
        bool active;
        uint256 minHoldingPercent;
    }
    
    struct LiquidityPosition {
        address pairToken;
        uint256 usdtzAmount;
        uint256 pairTokenAmount;
        uint256 lpTokens;
        bool active;
        uint256 createdAt;
    }
    
    address public immutable usdtzToken;
    address public immutable pancakeRouter;
    address public immutable pancakeFactory;
    address public wbnbAddress;
    
    uint256 public constant PRECISION = 1e18;
    uint256 public constant LIQUIDITY_RESERVE = 500000000e18;
    
    TokenConfig[] public topTokens;
    mapping(address => TokenConfig) public tokenConfigs;
    mapping(address => LiquidityPosition[]) public liquidityPositions;
    
    uint256 public totalLiquidityProvided;
    uint256 public minLiquidityPerPair = 1000e18;
    uint256 public maxLiquidityPerPair = 50000000e18;
    
    address public treasuryAddress;
    uint256 public liquidtyUnlockTime;
    
    event LiquidityAdded(address indexed token, uint256 usdtzAmount, uint256 tokenAmount, uint256 lpAmount);
    event LiquidityRemoved(address indexed token, uint256 usdtzAmount, uint256 tokenAmount);
    event TokenConfigUpdated(address indexed token, uint256 newWeight);
    event EmergencyLiquidityWithdraw(address indexed token, uint256 amount);
    
    constructor(
        address _usdtzToken,
        address _pancakeRouter,
        address _pancakeFactory,
        address _wbnb,
        address _treasury
    ) {
        usdtzToken = _usdtzToken;
        pancakeRouter = _pancakeRouter;
        pancakeFactory = _pancakeFactory;
        wbnbAddress = _wbnb;
        treasuryAddress = _treasury;
        liquidtyUnlockTime = block.timestamp + 365 days;
    }
    
    function initializeTopTokens(
        address[] calldata tokens,
        uint256[] calldata allocations
    ) external onlyOwner {
        require(tokens.length == allocations.length, "Length mismatch");
        
        for (uint i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0) && tokens[i] != usdtzToken, "Invalid token");
            
            tokenConfigs[tokens[i]] = TokenConfig({
                tokenAddress: tokens[i],
                name: getTokenName(tokens[i]),
                weight: allocations[i],
                targetAllocation: allocations[i],
                active: true,
                minHoldingPercent: 100
            });
            
            topTokens.push(TokenConfig({
                tokenAddress: tokens[i],
                name: getTokenName(tokens[i]),
                weight: allocations[i],
                targetAllocation: allocations[i],
                active: true,
                minHoldingPercent: 100
            }));
        }
    }
    
    function getTokenName(address token) internal view returns (string memory) {
        (bool success, bytes memory data) = token.staticcall(abi.encodeWithSignature("name()"));
        if (success && data.length > 0) {
            return string(data);
        }
        return "Unknown";
    }
    
    function setupInitialLiquidity(
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external nonReentrant onlyOwner {
        require(tokens.length == amounts.length, "Length mismatch");
        require(IERC20(usdtzToken).balanceOf(address(this)) >= LIQUIDITY_RESERVE, "Insufficient USDTZ");
        
        uint256 amountPerToken = LIQUIDITY_RESERVE / (2 * tokens.length);
        
        for (uint i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            require(tokenConfigs[token].active, "Token not configured");
            
            uint256 amount = amounts[i];
            if (amount == 0) continue;
            
            uint256 allowance = IERC20(token).allowance(msg.sender, address(this));
            if (allowance < amount) {
                require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
            }
            
            address pair = IPancakeSwapFactory(pancakeFactory).getPair(usdtzToken, token);
            if (pair == address(0)) {
                pair = IPancakeSwapFactory(pancakeFactory).createPair(usdtzToken, token);
            }
            
            IERC20(usdtzToken).approve(pancakeRouter, amountPerToken);
            IERC20(token).approve(pancakeRouter, amount);
            
            (uint256 usdtzUsed, uint256 tokenUsed, uint256 lp) = IPancakeSwapRouter(pancakeRouter).addLiquidity(
                usdtzToken, token,
                amountPerToken, amount,
                0, 0,
                address(this),
                block.timestamp + 3600
            );
            
            liquidityPositions[token].push(LiquidityPosition({
                pairToken: token,
                usdtzAmount: usdtzUsed,
                pairTokenAmount: tokenUsed,
                lpTokens: lp,
                active: true,
                createdAt: block.timestamp
            }));
            
            totalLiquidityProvided += usdtzUsed;
            
            emit LiquidityAdded(token, usdtzUsed, tokenUsed, lp);
        }
    }
    
    function setupBNBLiquidity(uint256 usdtzAmount) external payable nonReentrant onlyOwner {
        require(msg.value > 0, "No BNB sent");
        
        uint256 amountPerSide = msg.value / 2;
        
        IERC20(usdtzToken).approve(pancakeRouter, usdtzAmount);
        
        (uint256 usdtzUsed, uint256 bnbUsed, uint256 lp) = IPancakeSwapRouter(pancakeRouter).addLiquidityETH{value: amountPerSide}(
            usdtzToken,
            usdtzAmount,
            0, 0,
            address(this),
            block.timestamp + 3600
        );
        
        liquidityPositions[wbnbAddress].push(LiquidityPosition({
            pairToken: wbnbAddress,
            usdtzAmount: usdtzUsed,
            pairTokenAmount: bnbUsed,
            lpTokens: lp,
            active: true,
            createdAt: block.timestamp
        }));
        
        totalLiquidityProvided += usdtzUsed;
        
        if (address(this).balance > 0) {
            payable(msg.sender).transfer(address(this).balance);
        }
        
        emit LiquidityAdded(wbnbAddress, usdtzUsed, bnbUsed, lp);
    }
    
    function updateTokenConfig(
        address token,
        uint256 newWeight,
        uint256 newAllocation
    ) external onlyOwner {
        require(tokenConfigs[token].tokenAddress != address(0), "Token not configured");
        
        tokenConfigs[token].weight = newWeight;
        tokenConfigs[token].targetAllocation = newAllocation;
        
        emit TokenConfigUpdated(token, newWeight);
    }
    
    function getTopTokens() external view returns (TokenConfig[] memory) {
        return topTokens;
    }
    
    function getLiquidityPositions(address token) external view returns (LiquidityPosition[] memory) {
        return liquidityPositions[token];
    }
    
    function removeLiquidity(address token) external onlyOwner nonReentrant {
        LiquidityPosition[] storage positions = liquidityPositions[token];
        require(positions.length > 0, "No positions");

        uint256 totalLP;
        for (uint i = 0; i < positions.length; i++) {
            if (positions[i].active) {
                totalLP += positions[i].lpTokens;
            }
        }

        require(totalLP > 0, "No active LP");

        address pair = IPancakeSwapFactory(pancakeFactory).getPair(usdtzToken, token);
        require(pair != address(0), "Pair does not exist");

        IERC20(pair).approve(pancakeRouter, totalLP);

        // Actually remove liquidity via the router
        (uint256 amountA, uint256 amountB) = IPancakeSwapRouter(pancakeRouter).removeLiquidity(
            usdtzToken,
            token,
            totalLP,
            0, // amountAMin - accept any amount (owner-only, can set slippage off-chain)
            0, // amountBMin
            address(this),
            block.timestamp + 300
        );

        // Mark positions as inactive
        for (uint i = 0; i < positions.length; i++) {
            if (positions[i].active) {
                positions[i].active = false;
                positions[i].lpTokens = 0;
            }
        }

        emit LiquidityRemoved(token, amountA, amountB);
    }
    
    function emergencyWithdrawToken(address token, uint256 amount) external onlyOwner {
        require(block.timestamp > liquidtyUnlockTime, "Liquidity locked");
        require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient balance");
        IERC20(token).transfer(treasuryAddress, amount);
        emit EmergencyLiquidityWithdraw(token, amount);
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        treasuryAddress = _treasury;
    }
    
    function setUnlockTime(uint256 _unlockTime) external onlyOwner {
        liquidtyUnlockTime = _unlockTime;
    }
    
    function setMinLiquidity(uint256 _min, uint256 _max) external onlyOwner {
        minLiquidityPerPair = _min;
        maxLiquidityPerPair = _max;
    }

    receive() external payable {}
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