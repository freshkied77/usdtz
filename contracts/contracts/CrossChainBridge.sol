// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20Extended {
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
    function name() external view returns (string memory);
}

interface ILiquidityVault {
    function addLiquidity(address token, uint256 amount) external;
    function removeLiquidity(address token, uint256 amount, address recipient) external;
    function getVaultBalance(address token) external view returns (uint256);
    function getOptimalAmount(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
}

contract CrossChainBridge is Ownable, ReentrancyGuard {

    struct ChainConfig {
        uint256 chainId;
        string name;
        address bridgeAddress;
        uint256 gasFee;
        uint256 minAmount;
        uint256 maxAmount;
        uint256 transferTimeout;
        bool active;
    }

    struct BridgeRequest {
        address user;
        address token;
        uint256 amount;
        uint256 destinationChainId;
        address recipient;
        uint256 fees;
        uint256 timestamp;
        bytes32 txHash;
        bool claimed;
        bool refunded;
    }

    mapping(uint256 => ChainConfig) public chainConfigs;
    mapping(bytes32 => BridgeRequest) public bridgeRequests;
    mapping(address => bool) public supportedTokens;
    mapping(uint256 => mapping(address => uint256)) public chainTokenFeeBalances;
    mapping(address => bool) public validators;
    mapping(address => bytes32[]) public userRequests;

    uint256 public validatorCount;
    uint256 public requiredSignatures;

    address public usdtzToken;
    address public liquidityVault;
    address public wrappedNativeToken;

    uint256 public constant FEE_PERCENTAGE = 25;
    uint256 public constant PROTOCOL_FEE_PERCENTAGE = 10;
    uint256 public constant MIN_BRIDGE_AMOUNT = 10 ether;
    uint256 public constant MAX_BRIDGE_AMOUNT = 1000000 ether;
    
    event BridgeInitiated(
        bytes32 indexed requestId,
        address indexed user,
        address token,
        uint256 amount,
        uint256 destinationChain,
        address recipient,
        uint256 fees
    );
    
    event BridgeClaimed(
        bytes32 indexed requestId,
        address indexed recipient,
        uint256 amount
    );
    
    event BridgeRefunded(
        bytes32 indexed requestId,
        address indexed user,
        uint256 amount
    );
    
    event ChainConfigUpdated(uint256 indexed chainId, bool active, uint256 gasFee);
    event LiquidityAdded(address indexed token, uint256 amount);
    event EmergencyWithdraw(address indexed token, uint256 amount);
    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);

    modifier onlySupportedToken(address token) {
        require(supportedTokens[token], "Token not supported");
        _;
    }

    modifier onlyValidator() {
        require(validators[msg.sender] || msg.sender == owner(), "Not a validator");
        _;
    }

    constructor(address _usdtzToken, address _wrappedNative) {
        usdtzToken = _usdtzToken;
        wrappedNativeToken = _wrappedNative;
        requiredSignatures = 1;
    }

    function addValidator(address _validator) external onlyOwner {
        require(!validators[_validator], "Already a validator");
        validators[_validator] = true;
        validatorCount++;
        emit ValidatorAdded(_validator);
    }

    function removeValidator(address _validator) external onlyOwner {
        require(validators[_validator], "Not a validator");
        validators[_validator] = false;
        validatorCount--;
        emit ValidatorRemoved(_validator);
    }

    function setRequiredSignatures(uint256 _required) external onlyOwner {
        require(_required > 0 && _required <= validatorCount + 1, "Invalid signature count");
        requiredSignatures = _required;
    }
    
    function setLiquidityVault(address _vault) external onlyOwner {
        liquidityVault = _vault;
    }
    
    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
    }
    
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }
    
    function setChainConfig(
        uint256 chainId,
        string memory name,
        address bridgeAddress,
        uint256 gasFee,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 transferTimeout,
        bool active
    ) external onlyOwner {
        chainConfigs[chainId] = ChainConfig({
            chainId: chainId,
            name: name,
            bridgeAddress: bridgeAddress,
            gasFee: gasFee,
            minAmount: minAmount,
            maxAmount: maxAmount,
            transferTimeout: transferTimeout,
            active: active
        });
        
        emit ChainConfigUpdated(chainId, active, gasFee);
    }
    
    function getChainConfig(uint256 chainId) external view returns (ChainConfig memory) {
        return chainConfigs[chainId];
    }
    
    function initiateBridge(
        address token,
        uint256 amount,
        uint256 destinationChainId,
        address recipient
    ) external nonReentrant onlySupportedToken(token) returns (bytes32 requestId) {
        require(amount >= MIN_BRIDGE_AMOUNT, "Amount below minimum");
        require(amount <= MAX_BRIDGE_AMOUNT, "Amount above maximum");
        
        ChainConfig memory destChain = chainConfigs[destinationChainId];
        require(destChain.active, "Destination chain not supported");
        
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        uint256 feeAmount = (amount * FEE_PERCENTAGE) / 10000;
        uint256 protocolFee = (feeAmount * PROTOCOL_FEE_PERCENTAGE) / 100;
        uint256 liquidityAmount = feeAmount - protocolFee;
        
        if (liquidityVault != address(0) && supportedTokens[token]) {
            IERC20(token).approve(liquidityVault, liquidityAmount);
            ILiquidityVault(liquidityVault).addLiquidity(token, liquidityAmount);
        }
        
        chainTokenFeeBalances[destinationChainId][token] += protocolFee;

        requestId = keccak256(abi.encodePacked(
            msg.sender,
            token,
            amount,
            destinationChainId,
            recipient,
            block.timestamp
        ));
        
        bridgeRequests[requestId] = BridgeRequest({
            user: msg.sender,
            token: token,
            amount: amount - feeAmount,
            destinationChainId: destinationChainId,
            recipient: recipient,
            fees: feeAmount,
            timestamp: block.timestamp,
            txHash: bytes32(0),
            claimed: false,
            refunded: false
        });
        
        userRequests[msg.sender].push(requestId);

        emit BridgeInitiated(requestId, msg.sender, token, amount - feeAmount, destinationChainId, recipient, feeAmount);
    }
    
    function claimBridge(
        bytes32 requestId,
        bytes32 txHash,
        bytes[] calldata signatures
    ) external onlyValidator nonReentrant {
        BridgeRequest storage request = bridgeRequests[requestId];
        require(!request.claimed, "Already claimed");
        require(!request.refunded, "Already refunded");
        require(request.user != address(0), "Request not found");

        // Verify validator signatures
        if (requiredSignatures > 1) {
            bytes32 messageHash = keccak256(abi.encodePacked(
                requestId, request.amount, request.recipient, txHash
            ));
            bytes32 ethSignedHash = keccak256(abi.encodePacked(
                "\x19Ethereum Signed Message:\n32", messageHash
            ));

            uint256 validSigs = 0;
            address lastSigner = address(0);
            for (uint256 i = 0; i < signatures.length; i++) {
                address signer = _recoverSigner(ethSignedHash, signatures[i]);
                require(signer > lastSigner, "Signatures not sorted or duplicate");
                if (validators[signer]) validSigs++;
                lastSigner = signer;
            }
            require(validSigs >= requiredSignatures, "Insufficient valid signatures");
        }

        request.claimed = true;
        request.txHash = txHash;

        // Use the request amount, not an arbitrary amount
        require(IERC20(request.token).transfer(request.recipient, request.amount), "Transfer failed");

        emit BridgeClaimed(requestId, request.recipient, request.amount);
    }

    function _recoverSigner(bytes32 ethSignedHash, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Invalid signature");
        return ecrecover(ethSignedHash, v, r, s);
    }
    
    function refundBridge(bytes32 requestId) external nonReentrant {
        BridgeRequest storage request = bridgeRequests[requestId];
        require(!request.claimed, "Already claimed");
        require(!request.refunded, "Already refunded");
        require(request.user != address(0), "Request not found");
        require(
            msg.sender == owner() || msg.sender == request.user,
            "Not authorized"
        );
        require(
            block.timestamp - request.timestamp >= chainConfigs[request.destinationChainId].transferTimeout,
            "Timeout not reached"
        );

        request.refunded = true;
        require(IERC20(request.token).transfer(request.user, request.amount), "Transfer failed");

        emit BridgeRefunded(requestId, request.user, request.amount);
    }
    
    function withdrawChainFees(uint256 chainId, address token, address recipient) external onlyOwner {
        uint256 fees = chainTokenFeeBalances[chainId][token];
        require(fees > 0, "No fees to withdraw");
        chainTokenFeeBalances[chainId][token] = 0;

        require(IERC20(token).transfer(recipient, fees), "Fee transfer failed");
    }
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient balance");
        IERC20(token).transfer(owner(), amount);
        emit EmergencyWithdraw(token, amount);
    }
    
    function getBridgeRequest(bytes32 requestId) external view returns (BridgeRequest memory) {
        return bridgeRequests[requestId];
    }
    
    function getPendingRequests(address user) external view returns (BridgeRequest[] memory) {
        bytes32[] storage ids = userRequests[user];
        uint256 count = 0;

        for (uint256 i = 0; i < ids.length; i++) {
            BridgeRequest storage req = bridgeRequests[ids[i]];
            if (!req.claimed && !req.refunded) {
                count++;
            }
        }

        BridgeRequest[] memory pending = new BridgeRequest[](count);
        count = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            BridgeRequest storage req = bridgeRequests[ids[i]];
            if (!req.claimed && !req.refunded) {
                pending[count] = req;
                count++;
            }
        }

        return pending;
    }

    function getUserRequestCount(address user) external view returns (uint256) {
        return userRequests[user].length;
    }
}

interface IZedxBridge {
    function bridgeAsset(uint256 destinationChainId, address asset, uint256 amount, address recipient) external payable;
    function claimAsset(bytes32 transferId, address recipient, uint256 amount) external;
    function getTransferStatus(bytes32 transferId) external view returns (uint8 status);
}

contract ZedxBridge is CrossChainBridge {
    uint256 public constant ZEDX_CHAIN_ID = 99999;
    
    mapping(bytes32 => bool) public transferIds;
    mapping(uint256 => uint256) public chainBalances;
    
    event ZedxBridgeInitiated(
        bytes32 indexed transferId,
        address indexed user,
        address token,
        uint256 amount,
        uint256 destChain
    );
    
    event ZedxBridgeClaimed(
        bytes32 indexed transferId,
        address indexed recipient,
        uint256 amount
    );
    
    constructor(address _usdtzToken, address _wrappedNative) CrossChainBridge(_usdtzToken, _wrappedNative) {
        chainConfigs[ZEDX_CHAIN_ID] = ChainConfig({
            chainId: ZEDX_CHAIN_ID,
            name: "Zedx Chain",
            bridgeAddress: address(this),
            gasFee: 0.01 ether,
            minAmount: 1 ether,
            maxAmount: 100000 ether,
            transferTimeout: 3600,
            active: true
        });
    }
    
    mapping(bytes32 => uint256) public zedxTransferAmounts;
    mapping(bytes32 => address) public zedxTransferTokens;

    function bridgeToZedx(address token, uint256 amount, address recipient) external nonReentrant onlySupportedToken(token) {
        require(amount >= MIN_BRIDGE_AMOUNT, "Amount below minimum");

        ChainConfig storage destChain = chainConfigs[ZEDX_CHAIN_ID];
        require(destChain.active, "Zedx chain not active");

        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint256 feeAmount = (amount * FEE_PERCENTAGE) / 10000;
        uint256 netAmount = amount - feeAmount;
        chainTokenFeeBalances[ZEDX_CHAIN_ID][token] += feeAmount;

        bytes32 transferId = keccak256(abi.encodePacked(
            msg.sender,
            token,
            amount,
            ZEDX_CHAIN_ID,
            recipient,
            block.timestamp,
            "ZEDX"
        ));

        transferIds[transferId] = true;
        zedxTransferAmounts[transferId] = netAmount;
        zedxTransferTokens[transferId] = token;
        chainBalances[ZEDX_CHAIN_ID] += netAmount;

        emit ZedxBridgeInitiated(transferId, msg.sender, token, netAmount, ZEDX_CHAIN_ID);
    }

    function claimFromZedx(bytes32 transferId, address recipient) external onlyValidator nonReentrant {
        require(transferIds[transferId], "Transfer not found");
        uint256 amount = zedxTransferAmounts[transferId];
        require(amount > 0, "Invalid transfer amount");

        transferIds[transferId] = false;
        zedxTransferAmounts[transferId] = 0;
        chainBalances[ZEDX_CHAIN_ID] -= amount;

        address token = zedxTransferTokens[transferId];
        require(IERC20(token).transfer(recipient, amount), "Transfer failed");

        emit ZedxBridgeClaimed(transferId, recipient, amount);
    }
    
    function getZedxBalance() external view returns (uint256) {
        return chainBalances[ZEDX_CHAIN_ID];
    }
    
    receive() external payable {}
}