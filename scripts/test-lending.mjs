import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import solc from 'solc';
import ganache from 'ganache';
import {BrowserProvider,ContractFactory,ZeroAddress} from 'ethers';
import {groth16} from 'snarkjs';
import {poseidon2} from 'poseidon-lite/poseidon2';
const source=`pragma solidity ^0.8.24;
contract Token {mapping(address=>uint)public balanceOf;mapping(address=>mapping(address=>uint))public allowance;function mint(address a,uint n)external{balanceOf[a]+=n;}function burn(address a,uint n)external{balanceOf[a]-=n;}function approve(address a,uint n)external returns(bool){allowance[msg.sender][a]=n;return true;}function transfer(address a,uint n)external returns(bool){balanceOf[msg.sender]-=n;balanceOf[a]+=n;return true;}function transferFrom(address f,address t,uint n)external returns(bool){allowance[f][msg.sender]-=n;balanceOf[f]-=n;balanceOf[t]+=n;return true;}}
contract Market {Token public baseToken;uint64 public index=1e15;bool public isWithdrawPaused;mapping(address=>int104)public principal;constructor(address t){baseToken=Token(t);}function setIndex(uint64 n)external{index=n;}function setPaused(bool p)external{isWithdrawPaused=p;}function userBasic(address a)external view returns(int104,uint64,uint64,uint16,uint8){return(principal[a],0,0,0,0);}function totalsBasic()external view returns(uint64,uint64,uint64,uint64,uint104,uint104,uint40,uint8){return(index,0,0,0,0,0,0,0);}function accrueAccount(address)external{}function supply(address t,uint n)external{require(t==address(baseToken));supplyTo(msg.sender,n);}function supplyTo(address a,uint n)public{baseToken.transferFrom(msg.sender,address(this),n);principal[a]=int104(uint104((uint104(principal[a])*uint(index)/1e15+n)*1e15/index));}function withdraw(address t,uint n)external{require(!isWithdrawPaused&&t==address(baseToken));uint balance=uint104(principal[msg.sender])*uint(index)/1e15;require(n<=balance);principal[msg.sender]=int104(uint104((balance-n)*1e15/index));baseToken.transfer(msg.sender,n);}}
`;
const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'Mock.sol':{content:source}},settings:{evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}})));
for(const e of output.errors??[])if(e.severity==='error')throw Error(e.formattedMessage);
const artifacts=JSON.parse(await readFile('public/contracts/compound.json','utf8'));
const transport=ganache.provider({logging:{quiet:true},chain:{chainId:31337,hardfork:'shanghai'},wallet:{totalAccounts:3}});
const provider=new BrowserProvider(transport,undefined,{cacheTimeout:-1});provider.pollingInterval=10;
const owner=await provider.getSigner(0),relay=await provider.getSigner(1),recipient=await provider.getSigner(2);
const deploy=async(a,args=[])=>{const c=await new ContractFactory(a.abi,a.bytecode,owner).deploy(...args);await c.waitForDeployment();return c;};
const mock=n=>({abi:output.contracts['Mock.sol'][n].abi,bytecode:'0x'+output.contracts['Mock.sol'][n].evm.bytecode.object});
const token=await deploy(mock('Token')),market=await deploy(mock('Market'),[await token.getAddress()]);
const hasher=await deploy(artifacts.poseidon),verifier=await deploy(artifacts.verifier),pool=await deploy(artifacts.pool,[await token.getAddress(),await hasher.getAddress(),await verifier.getAddress(),await market.getAddress()]);
const ownerAddress=await owner.getAddress(),recipientAddress=await recipient.getAddress(),poolAddress=await pool.getAddress(),tokenAddress=await token.getAddress(),marketAddress=await market.getAddress();
const hash=(a,b)=>poseidon2([BigInt(a),BigInt(b)]);
await(await token.mint(ownerAddress,100000000n)).wait();await(await token.approve(poolAddress,20000000n)).wait();
const pre=hash(789123n,456123n);await(await pool.depositUSDC(20000000n,pre,1)).wait();
const info=await pool.depositInfo(pre);assert.equal(info.assets,20000000n);assert(info.shares>0n);assert.equal(await pool.liabilities(),info.shares);assert.equal(await token.balanceOf(poolAddress),0n);
const initial=(await pool.previewRedeem.staticCall(info.shares))[0];assert(initial<=20000000n);
await(await token.transfer(poolAddress,1000000n)).wait();await(await token.approve(marketAddress,20000000n)).wait();await(await market.supplyTo(poolAddress,20000000n)).wait();
assert.equal((await pool.previewRedeem.staticCall(info.shares))[0],initial,'idle USDC and donated Comet principal cannot become fake yield');
await(await market.setIndex(1100000000000000n)).wait();await(await token.mint(marketAddress,10000000n)).wait();
const earned=(await pool.previewRedeem.staticCall(info.shares))[0];assert(earned>initial);assert(earned<22000000n);
await assert.rejects(pool.depositUSDC.staticCall(100000001n,hash(9n,10n),1),'deposit cap');
const leaves=[hash(info.shares,pre)];
function path(index){let layer=[...leaves],zero=0n,cursor=index;const siblings=[],pathIndices=[];for(let d=0;d<16;d++){siblings.push((layer[cursor^1]??zero).toString());pathIndices.push(cursor%2);const next=[];for(let i=0;i<layer.length;i+=2)next.push(hash(layer[i],layer[i+1]??zero));layer=next;zero=hash(zero,zero);cursor=Math.floor(cursor/2);}return{root:layer[0].toString(),siblings,pathIndices};}
async function prove(input){const p=await groth16.fullProve(input,'public/zk/withdraw.wasm','public/zk/withdraw.zkey',undefined,undefined,{singleThread:true});return JSON.parse('['+await groth16.exportSolidityCallData(p.proof,p.publicSignals)+']');}
const deadline=(await provider.getBlock('latest')).timestamp+3600;
const exit={recipient:recipientAddress,relayer:await relay.getAddress(),fee:10000n,deadline,minimumAssets:earned-10000n};
console.log('Compound accounting, donated-funds exclusion, six-decimal rounding and market interest valuation passed. Generating real proof.');
const proof=await prove({...path(0),nullifierHash:hash(789123n,0n).toString(),value:info.shares.toString(),context:(await pool.contextHash(exit)).toString(),mode:0,exposedCommitment:'0',nullifier:'789123',secret:'456123'});
await assert.rejects(pool.connect(relay).withdraw.staticCall(...proof,{...exit,minimumAssets:1n}),'minimum payout is proof-bound');
await(await market.setPaused(true)).wait();await assert.rejects(pool.connect(relay).withdraw.staticCall(...proof,exit),'paused market');assert.equal(await pool.spent(hash(789123n,0n)),false);
await(await market.setPaused(false)).wait();const cash=await token.balanceOf(marketAddress);await(await token.burn(marketAddress,cash)).wait();await assert.rejects(pool.connect(relay).withdraw.staticCall(...proof,exit),'illiquid market');assert.equal(await pool.spent(hash(789123n,0n)),false);await(await token.mint(marketAddress,cash)).wait();
await(await market.setIndex(950000000000000n)).wait();assert((await pool.previewRedeem.staticCall(info.shares))[0]<20000000n);await assert.rejects(pool.connect(relay).withdraw.staticCall(...proof,exit),'loss below minimum');assert.equal(await pool.spent(hash(789123n,0n)),false);
await(await market.setIndex(1100000000000000n)).wait();await(await pool.connect(relay).withdraw(...proof,exit)).wait();assert.equal(await token.balanceOf(recipientAddress),earned-10000n);assert.equal(await pool.liabilities(),0n);await assert.rejects(pool.connect(relay).withdraw.staticCall(...proof,exit),'replay');
// A new note after the first redemption can still exit without a relayer.
const pre2=hash(123789n,321987n);await(await token.approve(poolAddress,100000n)).wait();await(await pool.depositUSDC(100000n,pre2,1)).wait();const info2=await pool.depositInfo(pre2);leaves.push(hash(info2.shares,pre2));
const value2=(await pool.previewRedeem.staticCall(info2.shares))[0];const direct={recipient:recipientAddress,relayer:ZeroAddress,fee:0,deadline,minimumAssets:value2};const proof2=await prove({...path(1),nullifierHash:hash(123789n,0n).toString(),value:info2.shares.toString(),context:(await pool.contextHash(direct)).toString(),mode:0,exposedCommitment:'0',nullifier:'123789',secret:'321987'});
await(await pool.withdraw(...proof2,direct)).wait();assert.equal(await pool.liabilities(),0n);assert.equal(await token.balanceOf(recipientAddress),earned-10000n+value2);
console.log('Actual proof redemption, paused/illiquid/loss rollback, minimum binding, replay rejection and self-submit fallback passed.');
await transport.disconnect();process.exit(0);
