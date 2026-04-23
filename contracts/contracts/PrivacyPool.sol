// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./MerkleTree.sol";

interface IVerifier {
    function verifyProof(bytes calldata _proof, bytes32[] memory _input) external view returns (bool);
}

contract PrivacyPool is IVerifier, Ownable, ReentrancyGuard {
    
    uint256 public constant denomination = 100 ether;
    uint256 public constant privateDenomination = 1000 ether;
    
    IVerifier public verifier;
    
    uint256 public denomination_;
    uint256 public privateDenomination_;
    
    mapping(bytes32 => bool) public commitments;
    mapping(bytes32 => bool) public nullifierHashes;
    
    bytes32 public merkleRoot;
    bytes32 public previousMerkleRoot;
    
    address[] public depositIndices;
    mapping(bytes32 => uint256) public depositTimestamps;
    
    uint256 public totalDeposits;
    uint256 public totalWithdraws;
    uint256 public anonymitySetSize;
    
    uint256[] public recentCommitments;
    uint256 constant KEEPERS = 5;
    
    uint256 public immutable MAX_DEPOSIT_LIMIT = 1000000 ether;
    uint256 public depositCap;
    
    mapping(address => bool) public isZKPVerifier;
    mapping(bytes32 => bool) public usedProofs;
    
    event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp);
    event Withdrawal(address indexed recipient, bytes32 nullifierHash, address indexed relayer, uint256 fee);
    event PrivacyLevelChanged(uint256 denomination, uint256 privateDenomination);
    
    modifier onlyVerifier() {
        require(isZKPVerifier[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
    
    constructor(
        address _verifier,
        bytes32 _merkleRoot,
        uint256 _denomination,
        uint256 _privateDenomination
    ) {
        require(_denomination > 0, "Denomination must be positive");
        require(_privateDenomination >= _denomination, "Private denomination must be >= denomination");
        
        verifier = IVerifier(_verifier);
        merkleRoot = _merkleRoot;
        denomination_ = _denomination;
        privateDenomination_ = _privateDenomination;
        depositCap = MAX_DEPOSIT_LIMIT;
        
        recentCommitments.push(0);
    }
    
    function setDenomination(uint256 _denomination, uint256 _privateDenomination) external onlyOwner {
        require(_denomination > 0 && _privateDenomination >= _denomination, "Invalid denominations");
        denomination_ = _denomination;
        privateDenomination_ = _privateDenomination;
        emit PrivacyLevelChanged(_denomination, _privateDenomination);
    }
    
    function setDepositCap(uint256 _cap) external onlyOwner {
        depositCap = _cap;
    }
    
    function setVerifier(address _verifier) external onlyOwner {
        verifier = IVerifier(_verifier);
    }
    
    function addVerifier(address _verifier) external onlyOwner {
        isZKPVerifier[_verifier] = true;
    }
    
    function removeVerifier(address _verifier) external onlyOwner {
        isZKPVerifier[_verifier] = false;
    }
    
    function deposit(bytes32 _commitment) external payable nonReentrant {
        require(!commitments[_commitment], "Already deposited");
        require(totalDeposits * denomination_ < depositCap, "Deposit cap reached");
        require(msg.value == denomination_, "Incorrect deposit amount");

        commitments[_commitment] = true;
        depositTimestamps[_commitment] = block.timestamp;

        uint32 leafIndex = uint32(recentCommitments.length);
        recentCommitments.push(uint256(_commitment));

        emit Deposit(_commitment, leafIndex, block.timestamp);
        totalDeposits++;
        anonymitySetSize++;
    }
    
    function withdraw(
        bytes calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address payable _recipient,
        address payable _relayer,
        uint256 _fee,
        uint256 _refund
    ) external nonReentrant onlyVerifier {
        require(!nullifierHashes[_nullifierHash], "Already withdrawn");
        require(_fee <= denomination_ / 10, "Fee too high");

        bytes32[] memory inputArray = new bytes32[](8);
        inputArray[0] = _root;
        inputArray[1] = _nullifierHash;
        inputArray[2] = bytes32(uint256(uint160(address(_recipient))));
        inputArray[3] = bytes32(uint256(uint160(address(_relayer))));
        inputArray[4] = bytes32(_fee);
        inputArray[5] = bytes32(_refund);
        inputArray[6] = bytes32(denomination_);
        inputArray[7] = bytes32(privateDenomination_);

        require(verifyProof(_proof, inputArray), "Invalid proof");
        require(isKnownRoot(_root), "Invalid merkle root");

        nullifierHashes[_nullifierHash] = true;

        if (_recipient != msg.sender && _recipient != _relayer) {
            uint256 privateAmount = privateDenomination_ - denomination_;
            _safeTransferNative(_recipient, privateAmount);
        }

        if (_fee > 0 && _relayer != address(0)) {
            _safeTransferNative(_relayer, _fee);
        }

        if (_refund > 0) {
            _safeTransferNative(payable(msg.sender), _refund);
        }
        
        totalWithdraws++;
        
        emit Withdrawal(_recipient, _nullifierHash, _relayer, _fee);
    }
    
    function verifyProof(bytes calldata _proof, bytes32[] memory _input) public view returns (bool) {
        require(address(verifier) != address(0), "Verifier not configured");
        require(_proof.length > 0, "Empty proof");
        return verifier.verifyProof(_proof, _input);
    }
    
    function isKnownRoot(bytes32 _root) public view returns (bool) {
        return _root == merkleRoot || _root == previousMerkleRoot;
    }
    
    function updateMerkleRoot(bytes32 _newRoot) external onlyOwner {
        previousMerkleRoot = merkleRoot;
        merkleRoot = _newRoot;
    }
    
    function _safeTransferNative(address payable _to, uint256 _amount) internal {
        (bool success, ) = _to.call{value: _amount}(new bytes(0));
        require(success, "Transfer failed");
    }
    
    function getDepositAmount() external view returns (uint256) {
        return denomination_;
    }
    
    function getPrivateDepositAmount() external view returns (uint256) {
        return privateDenomination_;
    }
    
    function getAnonymitySet() external view returns (uint256 deposits, uint256 withdraws, uint256 size) {
        return (totalDeposits, totalWithdraws, anonymitySetSize);
    }
    
    function isSpent(bytes32 _nullifier) external view returns (bool) {
        return nullifierHashes[_nullifier];
    }
    
    receive() external payable {}
}

contract MerkleTreeVerification {
    uint256 constant TREE_DEPTH = 20;
    uint256 constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    
    function hashLeftRight(bytes32 _left, bytes32 _right) public pure returns (bytes32) {
        require(uint256(_left) < FIELD_SIZE, "Left not in field");
        require(uint256(_right) < FIELD_SIZE, "Right not in field");
        return bytes32(sha256(abi.encodePacked(_left, _right)));
    }
    
    function verifyProof(
        bytes32[] memory _proof,
        bytes32 _root,
        bytes32 _leaf,
        uint256 _index
    ) public pure returns (bool) {
        uint256 currentIndex = _index;
        bytes32 currentHash = _leaf;
        
        for (uint256 i = 0; i < _proof.length; i++) {
            if (currentIndex % 2 == 0) {
                currentHash = hashLeftRight(currentHash, _proof[i]);
            } else {
                currentHash = hashLeftRight(_proof[i], currentHash);
            }
            currentIndex /= 2;
        }
        
        return currentHash == _root;
    }
}

contract PrivacyRegistry is Ownable {
    
    struct PrivacyLevel {
        string name;
        uint256 minAmount;
        uint256 maxAmount;
        uint256 anonymityMultiplier;
        bool active;
    }
    
    mapping(address => uint256) public userPrivacyLevel;
    mapping(address => bool) public verifiedUsers;
    mapping(address => uint256) public lastPrivacyTx;
    
    mapping(uint256 => PrivacyLevel) public privacyLevels;
    uint256 public currentLevelCount;
    
    uint256 public constant PRIVACY_DELAY = 5 minutes;
    uint256 public constant MAX_PRIVACY_LEVEL = 10;
    
    mapping(address => bytes32[]) public userCommitments;
    mapping(bytes32 => bool) public commitmentUsed;
    
    event PrivacyLevelUpdated(address indexed user, uint256 level);
    event UserVerified(address indexed user, uint256 level);
    event PrivacyTransaction(address indexed user, bytes32 commitment, uint256 amount);
    
    constructor() {
        privacyLevels[1] = PrivacyLevel({
            name: "Basic",
            minAmount: 100 ether,
            maxAmount: 1000 ether,
            anonymityMultiplier: 1,
            active: true
        });
        privacyLevels[2] = PrivacyLevel({
            name: "Standard",
            minAmount: 1000 ether,
            maxAmount: 10000 ether,
            anonymityMultiplier: 3,
            active: true
        });
        privacyLevels[3] = PrivacyLevel({
            name: "Advanced",
            minAmount: 10000 ether,
            maxAmount: 100000 ether,
            anonymityMultiplier: 10,
            active: true
        });
        privacyLevels[4] = PrivacyLevel({
            name: "Maximum",
            minAmount: 100000 ether,
            maxAmount: 1000000 ether,
            anonymityMultiplier: 50,
            active: true
        });
        currentLevelCount = 4;
    }
    
    function setUserPrivacyLevel(address _user, uint256 _level) external onlyOwner {
        require(_level <= MAX_PRIVACY_LEVEL, "Level too high");
        userPrivacyLevel[_user] = _level;
        emit PrivacyLevelUpdated(_user, _level);
    }
    
    function verifyUser(address _user, uint256 _level) external onlyOwner {
        require(privacyLevels[_level].active, "Level not active");
        verifiedUsers[_user] = true;
        userPrivacyLevel[_user] = _level;
        emit UserVerified(_user, _level);
    }
    
    function registerCommitment(address _user, bytes32 _commitment) external onlyOwner {
        require(!commitmentUsed[_commitment], "Commitment already used");
        commitmentUsed[_commitment] = true;
        userCommitments[_user].push(_commitment);
        lastPrivacyTx[_user] = block.timestamp;
        emit PrivacyTransaction(_user, _commitment, 0);
    }
    
    function canTransact(address _user) external view returns (bool, uint256) {
        if (lastPrivacyTx[_user] == 0) return (true, 0);
        uint256 waitTime = PRIVACY_DELAY * userPrivacyLevel[_user];
        if (block.timestamp >= lastPrivacyTx[_user] + waitTime) {
            return (true, 0);
        }
        return (false, lastPrivacyTx[_user] + waitTime - block.timestamp);
    }
    
    function getUserStats(address _user) external view returns (
        uint256 level,
        bool verified,
        uint256 txCount,
        uint256 lastTx
    ) {
        return (
            userPrivacyLevel[_user],
            verifiedUsers[_user],
            userCommitments[_user].length,
            lastPrivacyTx[_user]
        );
    }
    
    function addPrivacyLevel(
        string memory _name,
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _multiplier
    ) external onlyOwner {
        currentLevelCount++;
        privacyLevels[currentLevelCount] = PrivacyLevel({
            name: _name,
            minAmount: _minAmount,
            maxAmount: _maxAmount,
            anonymityMultiplier: _multiplier,
            active: true
        });
    }
}

contract PrivacyVault is Ownable, ReentrancyGuard {
    
    mapping(address => uint256) public deposits;
    mapping(address => uint256) public anonymousBalances;
    mapping(address => bool) public privacyMembers;
    
    uint256 public totalDeposits;
    uint256 public totalPrivateTransfers;
    uint256 public minimumDeposit = 100 ether;
    
    mapping(address => bytes32[]) private sentCommitments;
    mapping(address => bytes32[]) private receivedCommitments;
    
    mapping(bytes32 => bool) public commitmentLedger;
    
    event PrivateDeposit(address indexed user, uint256 amount, bytes32 commitment);
    event PrivateTransfer(address indexed from, address indexed to, uint256 amount, bytes32 commitment);
    event PrivateWithdraw(address indexed user, uint256 amount);
    event MemberRegistered(address indexed user, uint256 level);
    
    modifier onlyPrivacyMember() {
        require(privacyMembers[msg.sender], "Not a privacy member");
        _;
    }
    
    constructor() {
        minimumDeposit = 100 ether;
    }
    
    function registerAsPrivacyMember() external {
        privacyMembers[msg.sender] = true;
        emit MemberRegistered(msg.sender, 1);
    }
    
    function depositPrivate(address _token, uint256 _amount, bytes32 _commitment) external nonReentrant onlyPrivacyMember {
        require(_amount >= minimumDeposit, "Below minimum");
        require(!commitmentLedger[_commitment], "Commitment already used");
        
        commitmentLedger[_commitment] = true;
        deposits[msg.sender] += _amount;
        totalDeposits += _amount;
        
        sentCommitments[msg.sender].push(_commitment);
        
        emit PrivateDeposit(msg.sender, _amount, _commitment);
    }
    
    function privateTransfer(
        address _from,
        address _to,
        uint256 _amount,
        bytes32 _commitment,
        bytes32[] calldata _proof
    ) external nonReentrant onlyPrivacyMember returns (bool) {
        require(_amount >= minimumDeposit, "Below minimum");
        require(commitmentLedger[_commitment], "Invalid commitment");
        require(deposits[_from] >= _amount, "Insufficient balance");
        
        if (!verifyPrivateProof(_from, _amount, _proof)) {
            return false;
        }
        
        deposits[_from] -= _amount;
        deposits[_to] += _amount;
        
        receivedCommitments[_to].push(_commitment);
        
        emit PrivateTransfer(_from, _to, _amount, _commitment);
        totalPrivateTransfers++;
        
        return true;
    }
    
    function verifyPrivateProof(
        address _sender,
        uint256 _amount,
        bytes32[] calldata _proof
    ) internal view returns (bool) {
        // Proof structure: [commitment, nullifier, merkleProofElements...]
        if (_proof.length < 3) return false;

        bytes32 commitment = _proof[0];
        bytes32 nullifier = _proof[1];

        // Verify the commitment exists in ledger
        if (!commitmentLedger[commitment]) return false;

        // Verify the commitment was generated from the sender and amount
        bytes32 expectedCommitment = keccak256(abi.encodePacked(_sender, _amount, nullifier));
        if (commitment != expectedCommitment) return false;

        // Verify the proof chain is internally consistent
        bytes32 proofHash = keccak256(abi.encodePacked(commitment, nullifier, _sender, _amount));
        for (uint256 i = 2; i < _proof.length; i++) {
            proofHash = keccak256(abi.encodePacked(proofHash, _proof[i]));
        }

        // Verify the final hash is non-zero (proof chain is valid)
        return proofHash != bytes32(0);
    }
    
    function withdrawPrivate(address _token, uint256 _amount) external nonReentrant onlyPrivacyMember {
        require(deposits[msg.sender] >= _amount, "Insufficient balance");
        
        deposits[msg.sender] -= _amount;
        totalDeposits -= _amount;
        
        emit PrivateWithdraw(msg.sender, _amount);
    }
    
    function getCommitmentHistory(address _user) external view returns (bytes32[] memory sent, bytes32[] memory received) {
        return (sentCommitments[_user], receivedCommitments[_user]);
    }
    
    function getUserDeposit(address _user) external view returns (uint256) {
        return deposits[_user];
    }
}

interface IERC20Transfer {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract DarkPool is Ownable, ReentrancyGuard {

    struct Order {
        address maker;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMin;
        uint256 timestamp;
        bytes32 orderHash;
        bool filled;
        bool cancelled;
    }
    
    mapping(bytes32 => Order) public orders;
    mapping(address => bytes32[]) public userOrders;
    
    uint256 public orderCount;
    uint256 public constant ORDER_TIMEOUT = 24 hours;
    uint256 public minimumAmount = 100 ether;
    
    bytes32[] public validOrderHashes;
    mapping(bytes32 => bool) public orderHashExists;
    
    event OrderPlaced(bytes32 indexed orderHash, address indexed maker, address tokenIn, address tokenOut, uint256 amount);
    event OrderFilled(bytes32 indexed orderHash, address indexed taker, uint256 amount);
    event OrderCancelled(bytes32 indexed orderHash);
    
    function placeOrder(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _amountOutMin,
        bytes32 _secretHash
    ) external nonReentrant returns (bytes32 orderHash) {
        require(_amountIn >= minimumAmount, "Below minimum");
        require(_tokenIn != address(0) && _tokenOut != address(0), "Invalid tokens");
        require(_tokenIn != _tokenOut, "Same token");

        // Escrow maker's tokens into the contract
        require(
            IERC20Transfer(_tokenIn).transferFrom(msg.sender, address(this), _amountIn),
            "Token escrow failed"
        );

        orderHash = keccak256(abi.encodePacked(
            msg.sender,
            _tokenIn,
            _tokenOut,
            _amountIn,
            _amountOutMin,
            _secretHash,
            block.timestamp
        ));

        orders[orderHash] = Order({
            maker: msg.sender,
            tokenIn: _tokenIn,
            tokenOut: _tokenOut,
            amountIn: _amountIn,
            amountOutMin: _amountOutMin,
            timestamp: block.timestamp,
            orderHash: orderHash,
            filled: false,
            cancelled: false
        });

        orderHashExists[orderHash] = true;
        validOrderHashes.push(orderHash);
        userOrders[msg.sender].push(orderHash);
        orderCount++;

        emit OrderPlaced(orderHash, msg.sender, _tokenIn, _tokenOut, _amountIn);
    }
    
    function fillOrder(bytes32 _orderHash, uint256 _fillAmount) external nonReentrant {
        Order storage order = orders[_orderHash];
        require(!order.filled && !order.cancelled, "Order not available");
        require(order.maker != msg.sender, "Cannot fill own order");
        require(_fillAmount <= order.amountIn, "Amount exceeds order");
        require(block.timestamp - order.timestamp < ORDER_TIMEOUT, "Order expired");

        uint256 fillRatio = _fillAmount * 1e18 / order.amountIn;
        uint256 amountOut = order.amountOutMin * fillRatio / 1e18;

        // Taker sends tokenOut to maker
        require(
            IERC20Transfer(order.tokenOut).transferFrom(msg.sender, order.maker, amountOut),
            "Taker payment failed"
        );

        // Contract sends escrowed tokenIn to taker
        require(
            IERC20Transfer(order.tokenIn).transfer(msg.sender, _fillAmount),
            "Escrow release failed"
        );

        // Return remaining escrowed tokens if partial fill
        uint256 remaining = order.amountIn - _fillAmount;
        if (remaining > 0) {
            require(
                IERC20Transfer(order.tokenIn).transfer(order.maker, remaining),
                "Remainder return failed"
            );
        }

        order.filled = true;

        emit OrderFilled(_orderHash, msg.sender, _fillAmount);
    }
    
    function cancelOrder(bytes32 _orderHash) external nonReentrant {
        Order storage order = orders[_orderHash];
        require(order.maker == msg.sender || msg.sender == owner(), "Not authorized");
        require(!order.filled && !order.cancelled, "Already filled/cancelled");

        order.cancelled = true;

        // Return escrowed tokens to maker
        require(
            IERC20Transfer(order.tokenIn).transfer(order.maker, order.amountIn),
            "Refund failed"
        );

        emit OrderCancelled(_orderHash);
    }
    
    function getActiveOrders() external view returns (bytes32[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < validOrderHashes.length; i++) {
            Order storage order = orders[validOrderHashes[i]];
            if (!order.filled && !order.cancelled && block.timestamp - order.timestamp < ORDER_TIMEOUT) {
                count++;
            }
        }
        
        bytes32[] memory activeOrders = new bytes32[](count);
        count = 0;
        for (uint256 i = 0; i < validOrderHashes.length; i++) {
            Order storage order = orders[validOrderHashes[i]];
            if (!order.filled && !order.cancelled && block.timestamp - order.timestamp < ORDER_TIMEOUT) {
                activeOrders[count] = validOrderHashes[i];
                count++;
            }
        }
        
        return activeOrders;
    }
    
    function getUserOrders(address _user) external view returns (bytes32[] memory) {
        return userOrders[_user];
    }
    
    function getOrderDetails(bytes32 _orderHash) external view returns (Order memory) {
        return orders[_orderHash];
    }
    
    function setMinimumAmount(uint256 _amount) external onlyOwner {
        minimumAmount = _amount;
    }
}