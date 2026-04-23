// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract MerkleTree {
    
    uint256 public constant TREE_DEPTH = 20;
    uint256 public constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    
    bytes32[] public filledSubtrees;
    bytes32[] public zeros;
    
    uint256 public currentRootIndex = 0;
    uint256 public nextIndex = 0;
    
    bytes32[] public roots;
    uint256 public constant ROOT_HISTORY_SIZE = 100;
    
    event LeafInserted(bytes32 indexed leaf, uint256 leafIndex, bytes32 root);
    
    constructor() {
        zeros = new bytes32[](TREE_DEPTH + 1);
        
        for (uint256 i = 0; i <= TREE_DEPTH; i++) {
            zeros[i] = bytes32(0);
            if (i < TREE_DEPTH) {
                zeros[i + 1] = keccak256(abi.encodePacked(zeros[i], zeros[i]));
            }
        }
        
        filledSubtrees = new bytes32[](TREE_DEPTH);
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            filledSubtrees[i] = zeros[i];
        }
        
        roots.push(zeros[TREE_DEPTH]);
    }
    
    function _hashLeftRight(bytes32 _left, bytes32 _right) internal pure returns (bytes32) {
        require(uint256(_left) < FIELD_SIZE, "Left not in field");
        require(uint256(_right) < FIELD_SIZE, "Right not in field");
        
        bytes32 combined = keccak256(abi.encodePacked(_left, _right));
        return combined;
    }
    
    function _insert(bytes32 _leaf) internal returns (uint256 index) {
        uint256 currentIndex = nextIndex;
        nextIndex++;
        
        bytes32 currentLevelHash = _leaf;
        bytes32 left;
        bytes32 right;
        
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                left = currentLevelHash;
                right = zeros[i];
                filledSubtrees[i] = currentLevelHash;
            } else {
                left = filledSubtrees[i];
                right = currentLevelHash;
            }
            
            currentLevelHash = _hashLeftRight(left, right);
            currentIndex /= 2;
        }
        
        bytes32 newRoot = currentLevelHash;
        if (roots.length >= ROOT_HISTORY_SIZE) {
            roots[currentRootIndex] = newRoot;
        } else {
            roots.push(newRoot);
        }
        currentRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        
        emit LeafInserted(_leaf, nextIndex - 1, newRoot);
        
        return nextIndex - 1;
    }
    
    function isKnownRoot(bytes32 _root) public view returns (bool) {
        if (roots.length == 0) return false;
        uint256 currentRootIndex_ = currentRootIndex;
        for (uint256 i = 0; i < ROOT_HISTORY_SIZE; i++) {
            if (roots[currentRootIndex_] == _root) {
                return true;
            }
            if (currentRootIndex_ == 0) {
                currentRootIndex_ = ROOT_HISTORY_SIZE - 1;
            } else {
                currentRootIndex_--;
            }
            if (i == roots.length - 1) break;
        }
        return false;
    }
    
    function getLastRoot() public view returns (bytes32) {
        return roots[currentRootIndex];
    }
    
    function getRootHistorySize() public view returns (uint256) {
        return roots.length;
    }
    
    function verifyProof(
        bytes32[] memory _proof,
        bytes32 _root,
        bytes32 _leaf,
        uint256 _leafIndex
    ) public view returns (bool) {
        uint256 currentIndex = _leafIndex;
        bytes32 currentHash = _leaf;
        
        for (uint256 i = 0; i < _proof.length; i++) {
            if (currentIndex % 2 == 0) {
                currentHash = _hashLeftRight(currentHash, _proof[i]);
            } else {
                currentHash = _hashLeftRight(_proof[i], currentHash);
            }
            currentIndex /= 2;
        }
        
        return currentHash == _root;
    }
    
    function getFilledSubtree(bytes32 _leaf, uint256 _index) public view returns (bytes32[] memory proof) {
        require(_index < 2 ** TREE_DEPTH, "Index out of range");
        
        proof = new bytes32[](TREE_DEPTH);
        bytes32 currentHash = _leaf;
        uint256 currentIndex = _index;
        
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                proof[i] = currentHash;
                currentHash = _hashLeftRight(currentHash, zeros[i]);
            } else {
                proof[i] = zeros[i];
                currentHash = _hashLeftRight(zeros[i], currentHash);
            }
            currentIndex /= 2;
        }
        
        return proof;
    }
}

contract IncrementalMerkleTree {
    uint256 public constant TREE_DEPTH = 32;
    uint256 public constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    
    struct State {
        bytes32 root;
        uint256 numberOfLeaves;
        mapping(uint256 => bytes32) filledSubtrees;
        mapping(uint256 => bytes32) zeros;
    }
    
    mapping(address => State) public states;
    address[] public verifierAddresses;
    
    function initialize(address _verifier) external {
        State storage state = states[_verifier];
        state.root = bytes32(0);
        state.numberOfLeaves = 0;
        
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            state.zeros[i] = bytes32(0);
            state.filledSubtrees[i] = bytes32(0);
        }
        
        bytes32 currentZero = bytes32(0);
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            currentZero = keccak256(abi.encodePacked(currentZero, currentZero));
            state.zeros[i] = currentZero;
        }
        
        state.filledSubtrees[0] = state.zeros[0];
        for (uint256 i = 1; i < TREE_DEPTH; i++) {
            state.filledSubtrees[i] = keccak256(abi.encodePacked(state.zeros[i - 1], state.zeros[i - 1]));
        }
    }
    
    function insert(address _verifier, bytes32 _leaf) external returns (uint256 index) {
        State storage state = states[_verifier];
        require(state.numberOfLeaves < 2 ** TREE_DEPTH, "Tree full");
        
        uint256 currentIndex = state.numberOfLeaves;
        state.numberOfLeaves++;
        
        bytes32 currentLevelHash = _leaf;
        
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                state.filledSubtrees[i] = currentLevelHash;
                currentLevelHash = keccak256(abi.encodePacked(currentLevelHash, state.zeros[i]));
            } else {
                currentLevelHash = keccak256(abi.encodePacked(state.filledSubtrees[i], currentLevelHash));
            }
            currentIndex /= 2;
        }
        
        state.root = currentLevelHash;
        
        return state.numberOfLeaves - 1;
    }
    
    function verify(
        address _verifier,
        bytes32[] memory _proof,
        bytes32 _root,
        bytes32 _leaf,
        uint256 _leafIndex
    ) external view returns (bool) {
        State storage state = states[_verifier];
        require(_root == state.root, "Invalid root");
        
        bytes32 currentHash = _leaf;
        uint256 currentIndex = _leafIndex;
        
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            bytes32 left;
            bytes32 right;
            
            if (currentIndex % 2 == 0) {
                left = currentHash;
                right = state.zeros[i];
            } else {
                left = _proof[i];
                right = currentHash;
            }
            
            currentHash = keccak256(abi.encodePacked(left, right));
            currentIndex /= 2;
        }
        
        return currentHash == _root;
    }
    
    function getRoot(address _verifier) external view returns (bytes32) {
        return states[_verifier].root;
    }
    
    function getNumberOfLeaves(address _verifier) external view returns (uint256) {
        return states[_verifier].numberOfLeaves;
    }
}

library PoseidonHasher {
    function poseidon(bytes32[] memory inputs) internal pure returns (bytes32) {
        bytes32 result = keccak256(abi.encodePacked(inputs[0], inputs[1]));
        for (uint256 i = 2; i < inputs.length; i++) {
            result = keccak256(abi.encodePacked(result, inputs[i]));
        }
        return result;
    }
    
    function hashLeftRight(bytes32 left, bytes32 right) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(left, right));
    }
}

contract CommitmentHasher {
    function commit(bytes32 _secret, address _account) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_secret, _account));
    }
    
    function nullifier(bytes32 _secret, address _account) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_secret, _account, "nullifier"));
    }
}