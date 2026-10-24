// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IWstETH {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
}
interface IPoseidon2 { function poseidon(uint256[2] calldata) external pure returns (uint256); }
interface IWithdrawalVerifier {
    function verifyProof(uint256[2] calldata, uint256[2][2] calldata, uint256[2] calldata, uint256[7] calldata) external view returns (bool);
}

/// @notice Experimental Hoodi-only full-note shielded wstETH pool. NOT audited.
/// @dev No upgrade hooks, owner, arbitrary adapters, ASP claims or mainnet support.
contract YieldveilTestnetPool {
    uint256 public constant FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 public constant DEPTH = 16;
    uint256 public constant MAX_DEPOSIT = 0.1 ether;
    uint256 public constant MAX_POOL = 10 ether;
    IWstETH public immutable asset;
    IPoseidon2 public immutable hasher;
    IWithdrawalVerifier public immutable verifier;
    uint256 public liabilities;
    uint256 public root;
    uint256[16] private zeros;
    uint256[16] private filled;
    uint256[64] public roots;
    uint256 private rootCursor;
    uint256[] private leaves;
    mapping(uint256 => bool) public spent;
    mapping(uint256 => bool) public usedPrecommitments;
    mapping(uint256 => address) public depositor;
    uint256 private entered;

    struct Exit {
        address recipient;
        address relayer;
        uint256 fee;
        uint256 deadline;
    }
    event Deposited(address indexed account, uint256 indexed commitment, uint256 value, uint256 leafIndex, uint256 precommitment);
    event Withdrawn(uint256 indexed nullifierHash, address indexed recipient, uint256 value, uint256 fee, uint256 mode);
    error InvalidInput(); error TransferFailed(); error UnknownRoot(); error AlreadySpent(); error InvalidProof(); error Unauthorized();
    modifier nonReentrant() { if (entered != 0) revert Unauthorized(); entered = 1; _; entered = 0; }

    constructor(address token, address poseidon, address proofVerifier) {
        require(block.chainid == 560048 || block.chainid == 31337, "TESTNET_ONLY");
        require(token.code.length > 0 && poseidon.code.length > 0 && proofVerifier.code.length > 0, "DEPENDENCY_NOT_CONTRACT");
        asset = IWstETH(token); hasher = IPoseidon2(poseidon); verifier = IWithdrawalVerifier(proofVerifier);
        uint256 z;
        for (uint256 i; i < DEPTH; i++) { zeros[i] = z; filled[i] = z; z = _hash(z, z); }
        root = z; roots[0] = z;
    }
    function leafCount() external view returns (uint256) { return leaves.length; }
    function getLeaves(uint256 from, uint256 count) external view returns (uint256[] memory result) {
        if (from > leaves.length || count > 256) revert InvalidInput();
        uint256 end = from + count; if (end > leaves.length) end = leaves.length;
        result = new uint256[](end - from);
        for (uint256 i = from; i < end; i++) result[i - from] = leaves[i];
    }
    function depositWstETH(uint256 amount, uint256 precommitment) external nonReentrant returns (uint256) {
        if (amount == 0 || amount > MAX_DEPOSIT) revert InvalidInput();
        uint256 beforeBalance = asset.balanceOf(address(this));
        if (!asset.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        return _deposit(asset.balanceOf(address(this)) - beforeBalance, precommitment);
    }
    function depositETH(uint256 precommitment, uint256 minimumShares) external payable nonReentrant returns (uint256) {
        if (msg.value == 0 || msg.value > MAX_DEPOSIT || minimumShares == 0) revert InvalidInput();
        uint256 beforeBalance = asset.balanceOf(address(this));
        (bool success,) = address(asset).call{value: msg.value}("");
        if (!success) revert TransferFailed();
        uint256 received = asset.balanceOf(address(this)) - beforeBalance;
        if (received < minimumShares) revert InvalidInput();
        return _deposit(received, precommitment);
    }
    function _deposit(uint256 value, uint256 pre) private returns (uint256 commitment) {
        if (value == 0 || value > MAX_DEPOSIT || liabilities + value > MAX_POOL || pre == 0 || pre >= FIELD || usedPrecommitments[pre]) revert InvalidInput();
        if (leaves.length >= 2 ** DEPTH) revert InvalidInput();
        usedPrecommitments[pre] = true;
        commitment = _hash(value, pre);
        if (depositor[commitment] != address(0)) revert InvalidInput();
        depositor[commitment] = msg.sender; liabilities += value;
        uint256 index = leaves.length; leaves.push(commitment);
        uint256 cursor = index; uint256 node = commitment;
        for (uint256 i; i < DEPTH; i++) {
            if (cursor % 2 == 0) { filled[i] = node; node = _hash(node, zeros[i]); }
            else node = _hash(filled[i], node);
            cursor /= 2;
        }
        root = node; rootCursor = (rootCursor + 1) % 64; roots[rootCursor] = node;
        emit Deposited(msg.sender, commitment, value, index, pre);
    }
    function contextHash(Exit calldata exit) public view returns (uint256) {
        return uint256(keccak256(abi.encode(block.chainid, address(this), exit.recipient, exit.relayer, exit.fee, exit.deadline))) % FIELD;
    }
    function withdraw(uint256[2] calldata a, uint256[2][2] calldata b, uint256[2] calldata c, uint256[7] calldata signals, Exit calldata exit) external nonReentrant {
        // signals: authorization, root, nullifierHash, value, context, mode, exposedCommitment.
        if (exit.recipient == address(0) || exit.deadline < block.timestamp || exit.fee >= signals[3] || signals[3] > liabilities) revert InvalidInput();
        if (exit.fee > 0 && (msg.sender != exit.relayer || exit.relayer == address(0))) revert Unauthorized();
        if (signals[4] != contextHash(exit) || signals[3] == 0 || signals[3] > MAX_DEPOSIT) revert InvalidInput();
        bool recognized;
        for (uint256 i; i < 64; i++) if (roots[i] == signals[1] && signals[1] != 0) { recognized = true; break; }
        if (!recognized) revert UnknownRoot();
        if (spent[signals[2]]) revert AlreadySpent();
        if (signals[5] == 1) {
            if (depositor[signals[6]] != msg.sender || exit.recipient != msg.sender || exit.fee != 0) revert Unauthorized();
        } else if (signals[5] != 0 || signals[6] != 0) revert InvalidInput();
        if (!verifier.verifyProof(a, b, c, signals)) revert InvalidProof();
        spent[signals[2]] = true; liabilities -= signals[3];
        if (!asset.transfer(exit.recipient, signals[3] - exit.fee)) revert TransferFailed();
        if (exit.fee > 0 && !asset.transfer(exit.relayer, exit.fee)) revert TransferFailed();
        emit Withdrawn(signals[2], exit.recipient, signals[3], exit.fee, signals[5]);
    }
    function _hash(uint256 a, uint256 b) private view returns (uint256) { return hasher.poseidon([a, b]); }
}
