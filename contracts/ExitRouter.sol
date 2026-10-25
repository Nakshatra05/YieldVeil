// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRouteToken {
    function balanceOf(address) external view returns(uint256);
    function transfer(address,uint256) external returns(bool);
    function transferFrom(address,address,uint256) external returns(bool);
    function approve(address,uint256) external returns(bool);
    function stEthPerToken() external view returns(uint256);
}
interface IRoutePool {
    struct Exit {address recipient;address relayer;uint256 fee;uint256 deadline;}
    function withdraw(uint256[2] calldata,uint256[2][2] calldata,uint256[2] calldata,uint256[7] calldata,Exit calldata) external;
    function depositWstETH(uint256,uint256) external returns(uint256);
}
interface IExitReserve {function exchange(uint256,address,uint256) external returns(uint256);}

/// @notice Funded Hoodi ETH inventory. Exchanges are atomic, not queued unstaking.
contract HoodiEthReserve {
    IRouteToken public immutable asset;
    address public immutable operator;
    uint256 private entered;
    constructor(address token){require(block.chainid==560048||block.chainid==31337,"TESTNET_ONLY");asset=IRouteToken(token);operator=msg.sender;}
    receive() external payable {}
    function quote(uint256 shares) public view returns(uint256){return shares*asset.stEthPerToken()/1e18*997/1000;}
    function exchange(uint256 shares,address recipient,uint256 minimum) external returns(uint256 output){
        require(entered==0&&shares>0&&recipient!=address(0),"INVALID");entered=1;
        output=quote(shares);require(output>=minimum&&output>0&&address(this).balance>=output,"LIQUIDITY_OR_SLIPPAGE");
        require(asset.transferFrom(msg.sender,address(this),shares),"TRANSFER");
        (bool ok,)=recipient.call{value:output}("");require(ok,"ETH_TRANSFER");entered=0;
    }
    function collectShares(uint256 amount) external {require(msg.sender==operator&&entered==0,"OPERATOR");require(asset.transfer(operator,amount),"TRANSFER");}
}

struct Route {
    address recipient;
    address relayer;
    uint256 gross;
    uint256 fee;
    uint256 changePrecommitment;
    uint256 minimum;
    uint256 deadline;
    uint8 output; // 0 = wstETH, 1 = funded Hoodi ETH
}

/// @notice Single-use, CREATE2-address-bound withdrawal instructions.
contract NoteExit {
    IRoutePool public immutable pool;
    IRouteToken public immutable asset;
    address public immutable factory;
    address public immutable reserve;
    bool private used;
    constructor(address p,address t,address r){pool=IRoutePool(p);asset=IRouteToken(t);reserve=r;factory=msg.sender;}
    function execute(uint256[2] calldata a,uint256[2][2] calldata b,uint256[2] calldata c,uint256[7] calldata signals,Route calldata x) external {
        require(msg.sender==factory&&!used,"FACTORY");used=true;
        require(ExitRouterFactory(factory).predict(signals[2],x)==address(this),"ROUTE");
        require(signals[5]==0&&signals[6]==0&&x.recipient!=address(0)&&x.relayer!=address(0)&&x.deadline>=block.timestamp,"INVALID");
        require(x.gross> x.fee&&x.gross<=signals[3]&&x.output<=1,"AMOUNT");
        uint256 change=signals[3]-x.gross;
        require((change==0)==(x.changePrecommitment==0),"CHANGE");
        pool.withdraw(a,b,c,signals,IRoutePool.Exit(address(this),address(this),x.fee,x.deadline));
        if(change>0){require(asset.approve(address(pool),change),"APPROVE");pool.depositWstETH(change,x.changePrecommitment);}
        if(x.fee>0)require(asset.transfer(x.relayer,x.fee),"FEE");
        uint256 net=x.gross-x.fee;
        if(x.output==0){require(net>=x.minimum&&asset.transfer(x.recipient,net),"OUTPUT");}
        else{require(asset.approve(reserve,net),"APPROVE");IExitReserve(reserve).exchange(net,x.recipient,x.minimum);}
    }
}

contract ExitRouterFactory {
    address public immutable pool;
    address public immutable asset;
    address public immutable reserve;
    address public immutable implementation;
    event Routed(uint256 indexed nullifierHash,address indexed recipient,address router,uint256 gross,uint256 fee,uint256 changePrecommitment,uint8 output);
    constructor(address p,address t,address r){require(block.chainid==560048||block.chainid==31337,"TESTNET_ONLY");require(p.code.length>0&&t.code.length>0&&r.code.length>0,"DEPENDENCY");pool=p;asset=t;reserve=r;implementation=address(new NoteExit(p,t,r));}
    function initCode() public view returns(bytes memory){return abi.encodePacked(hex"3d602d80600a3d3981f3",hex"363d3d373d3d3d363d73",implementation,hex"5af43d82803e903d91602b57fd5bf3");}
    function predict(uint256 nullifierHash,Route calldata route) public view returns(address){
        bytes32 salt=keccak256(abi.encode(nullifierHash,route));
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff),address(this),salt,keccak256(initCode()))))));
    }
    function execute(uint256[2] calldata a,uint256[2][2] calldata b,uint256[2] calldata c,uint256[7] calldata signals,Route calldata route) external {
        require(msg.sender==route.relayer,"RELAYER");
        bytes memory code=initCode();bytes32 salt=keccak256(abi.encode(signals[2],route));address router;
        assembly {router:=create2(0,add(code,32),mload(code),salt)}
        require(router!=address(0),"CREATE2");
        NoteExit(router).execute(a,b,c,signals,route);
        emit Routed(signals[2],route.recipient,router,route.gross,route.fee,route.changePrecommitment,route.output);
    }
}
