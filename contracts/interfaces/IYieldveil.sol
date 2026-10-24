// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Proposed integration ABI, NOT a deployed or implemented custody pool.
/// @dev Public-input ordering must be finalized alongside reviewed circuits.
interface IYieldveil {
    struct Proof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
    }

    struct Withdrawal {
        uint256 value; // Gross wstETH debited, including fee.
        uint256 stateRoot;
        uint256 associationRoot;
        uint256 nullifierHash;
        uint256 changeCommitment;
        address recipient;
        address relayer;
        uint256 fee;
        address exitAdapter;
        uint256 minimumOut;
        uint256 deadline;
        uint256 destinationChainId;
    }

    event Deposited(address indexed depositor, uint256 commitment, uint256 label, uint256 value, uint256 precommitment);
    event Withdrawn(address indexed processor, uint256 value, uint256 nullifierHash, uint256 changeCommitment);
    event Ragequit(address indexed depositor, uint256 commitment, uint256 label, uint256 value);
    event RootUpdated(uint256 root, string cid, uint256 timestamp);

    function deposit(uint256 precommitment, uint256 minimumShares) external payable;
    function depositWstETH(uint256 amount, uint256 precommitment) external;
    function relay(Withdrawal calldata withdrawal, Proof calldata proof) external;
    function ragequit(uint256 commitment, uint256 label, uint256 value, uint256 nullifierHash, Proof calldata proof) external;
    function updateRoot(uint256 root, string calldata cid) external;
    function windDown() external;
}
