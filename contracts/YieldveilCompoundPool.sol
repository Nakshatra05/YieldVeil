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

/// @notice Base Sepolia-only Compound III-backed shielded Circle test USDC pool. NOT audited.
/// @dev No upgrade hooks, owner, arbitrary adapters, ASP claims or mainnet support.
contract YieldveilCompoundPool {
    uint256 public constant FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 public constant DEPTH = 16;
    uint256 public constant MAX_DEPOSIT = 100 * 1e6;
    uint256 public constant MAX_POOL = 10000 * 1e6;
    uint256 public constant MAX_SHARES = 1e17;
    uint256 private constant VIRTUAL_SHARES = 1e6;
    IYieldComet public immutable market;
    uint256 public ownedPrincipal;
    struct DepositInfo {uint256 shares;uint256 assets;uint256 blockNumber;}
    mapping(uint256 => DepositInfo) public depositInfo;
    event AssetsWithdrawn(uint256 indexed nullifierHash,uint256 assets,uint256 received,uint256 fee);
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
        uint256 minimumAssets;
    }
    event Deposited(address indexed account, uint256 indexed commitment, uint256 value, uint256 leafIndex, uint256 precommitment);
    event Withdrawn(uint256 indexed nullifierHash, address indexed recipient, uint256 value, uint256 fee, uint256 mode);
    error InvalidInput(); error TransferFailed(); error UnknownRoot(); error AlreadySpent(); error InvalidProof(); error Unauthorized();
    modifier nonReentrant() { if (entered != 0) revert Unauthorized(); entered = 1; _; entered = 0; }

    constructor(address token, address poseidon, address proofVerifier, address comet) {
        require(block.chainid == 84532 || block.chainid == 31337, "TESTNET_ONLY");
        require(token.code.length > 0 && poseidon.code.length > 0 && proofVerifier.code.length > 0, "DEPENDENCY_NOT_CONTRACT");
        if (block.chainid == 84532) require(token == 0x036CbD53842c5426634e7929541eC2318f3dCF7e, "CIRCLE_USDC_ONLY");
        require(comet.code.length>0 && IYieldComet(comet).baseToken()==token,"MARKET_ASSET");
        if(block.chainid==84532)require(comet==0x571621Ce60Cebb0c1D442B5afb38B1663C6Bf017,"COMPOUND_ONLY");
        market=IYieldComet(comet);
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
    function principal() private view returns(uint256){(int104 p,,,,)=market.userBasic(address(this));require(p>=0,"NO_BORROWING");return uint104(p);}
    function accountedAssets() public view returns(uint256){
        (uint64 index,,,,,,,)=market.totalsBasic();
        uint256 amount=ownedPrincipal*uint256(index)/1e15;
        // One micro-USDC stays reserved for Comet principal conversion rounding.
        return amount>0?amount-1:0;
    }
    function convertToAssets(uint256 shares) public view returns(uint256){return shares*(accountedAssets()+1)/(liabilities+VIRTUAL_SHARES);}
    function previewRedeem(uint256 shares) external nonReentrant returns(uint256 assets,uint256 cash,bool paused){
        market.accrueAccount(address(this));
        require(shares<=liabilities,"SHARES");
        return(convertToAssets(shares),asset.balanceOf(address(market)),market.isWithdrawPaused());
    }
    function previewDeposit(uint256 amount) external nonReentrant returns(uint256){market.accrueAccount(address(this));return amount*(liabilities+VIRTUAL_SHARES)/(accountedAssets()+1);}
    function depositUSDC(uint256 amount,uint256 precommitment,uint256 minimumShares) external nonReentrant returns(uint256){
        if(amount==0||amount>MAX_DEPOSIT||minimumShares==0)revert InvalidInput();
        market.accrueAccount(address(this));
        uint256 beforeAssets=accountedAssets();require(beforeAssets+amount<=MAX_POOL,"POOL_CAP");
        uint256 beforeBalance=asset.balanceOf(address(this));
        if(!asset.transferFrom(msg.sender,address(this),amount)||asset.balanceOf(address(this))-beforeBalance!=amount)revert TransferFailed();
        uint256 beforePrincipal=principal();
        require(IYieldApprove(address(asset)).approve(address(market),amount),"APPROVE");
        market.supply(address(asset),amount);
        ownedPrincipal+=principal()-beforePrincipal;
        uint256 credited=accountedAssets()-beforeAssets;
        uint256 shares=credited*(liabilities+VIRTUAL_SHARES)/(beforeAssets+1);
        require(shares>=minimumShares,"MINIMUM_SHARES");
        uint256 commitment=_deposit(shares,precommitment);
        depositInfo[precommitment]=DepositInfo(shares,amount,block.number);
        return commitment;
    }
    function _deposit(uint256 value, uint256 pre) private returns (uint256 commitment) {
        if (value == 0 || value > MAX_SHARES || pre == 0 || pre >= FIELD || usedPrecommitments[pre]) revert InvalidInput();
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
        return uint256(keccak256(abi.encode(block.chainid, address(this), exit.recipient, exit.relayer, exit.fee, exit.deadline, exit.minimumAssets))) % FIELD;
    }
    function withdraw(uint256[2] calldata a, uint256[2][2] calldata b, uint256[2] calldata c, uint256[7] calldata signals, Exit calldata exit) external nonReentrant {
        // signals: authorization, root, nullifierHash, value, context, mode, exposedCommitment.
        if (exit.recipient == address(0) || exit.deadline < block.timestamp || signals[3] > liabilities) revert InvalidInput();
        if (exit.fee > 0 && (msg.sender != exit.relayer || exit.relayer == address(0))) revert Unauthorized();
        if (signals[4] != contextHash(exit) || signals[3] == 0 || signals[3] > MAX_SHARES) revert InvalidInput();
        bool recognized;
        for (uint256 i; i < 64; i++) if (roots[i] == signals[1] && signals[1] != 0) { recognized = true; break; }
        if (!recognized) revert UnknownRoot();
        if (spent[signals[2]]) revert AlreadySpent();
        if (signals[5] == 1) {
            if (depositor[signals[6]] != msg.sender || exit.recipient != msg.sender || exit.fee != 0) revert Unauthorized();
        } else if (signals[5] != 0 || signals[6] != 0) revert InvalidInput();
        if (!verifier.verifyProof(a, b, c, signals)) revert InvalidProof();
        market.accrueAccount(address(this));
        uint256 gross=convertToAssets(signals[3]);
        if(gross<=exit.fee||gross-exit.fee<exit.minimumAssets||exit.minimumAssets==0)revert InvalidInput();
        uint256 beforePrincipal=principal();uint256 beforeBalance=asset.balanceOf(address(this));
        spent[signals[2]]=true;liabilities-=signals[3];
        market.withdraw(address(asset),gross);
        uint256 consumed=beforePrincipal-principal();require(consumed<=ownedPrincipal,"PRINCIPAL");ownedPrincipal-=consumed;
        require(asset.balanceOf(address(this))-beforeBalance==gross,"REDEMPTION");
        if(!asset.transfer(exit.recipient,gross-exit.fee))revert TransferFailed();
        if(exit.fee>0&&!asset.transfer(exit.relayer,exit.fee))revert TransferFailed();
        emit AssetsWithdrawn(signals[2],gross,gross-exit.fee,exit.fee);
        emit Withdrawn(signals[2], exit.recipient, signals[3], exit.fee, signals[5]);
    }
    function _hash(uint256 a, uint256 b) private view returns (uint256) { return hasher.poseidon([a, b]); }
}

interface IYieldApprove {function approve(address,uint256) external returns(bool);}
interface IYieldComet {
 function baseToken() external view returns(address);
 function userBasic(address) external view returns(int104,uint64,uint64,uint16,uint8);
 function totalsBasic() external view returns(uint64,uint64,uint64,uint64,uint104,uint104,uint40,uint8);
 function accrueAccount(address) external;
 function supply(address,uint256) external;
 function withdraw(address,uint256) external;
 function isWithdrawPaused() external view returns(bool);
}
