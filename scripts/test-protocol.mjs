import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ganache from 'ganache';
import solc from 'solc';
import {BrowserProvider,ContractFactory,parseEther,ZeroAddress} from 'ethers';
import {groth16} from 'snarkjs';
import {poseidon2} from 'poseidon-lite/poseidon2';

// Test-only adapter, never included in the deployment artifacts.
const source=`pragma solidity ^0.8.24;
contract TestWstETH {
 mapping(address=>uint) public balanceOf;
 mapping(address=>mapping(address=>uint)) public allowance;
 function mint(address to,uint n) external {balanceOf[to]+=n;}
 receive() external payable {balanceOf[msg.sender]+=msg.value*5/6;}
 function approve(address to,uint n) external returns(bool){allowance[msg.sender][to]=n;return true;}
 function transfer(address to,uint n) external returns(bool){balanceOf[msg.sender]-=n;balanceOf[to]+=n;return true;}
 function transferFrom(address from,address to,uint n) external returns(bool){allowance[from][msg.sender]-=n;balanceOf[from]-=n;balanceOf[to]+=n;return true;}
}`;
const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'Mock.sol':{content:source}},settings:{evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}})));
const mock=output.contracts['Mock.sol'].TestWstETH;
const artifacts=JSON.parse(await readFile('public/contracts/artifacts.json','utf8'));
const transport=ganache.provider({logging:{quiet:true},chain:{chainId:31337,hardfork:'shanghai'},wallet:{totalAccounts:4}});
const provider=new BrowserProvider(transport);provider.pollingInterval=10;
const owner=await provider.getSigner(0),submitter=await provider.getSigner(1),recipient=await provider.getSigner(2);
const ownerAddress=await owner.getAddress(),recipientAddress=await recipient.getAddress();
const deploy=async(a,args=[])=>{const c=await new ContractFactory(a.abi,a.bytecode,owner).deploy(...args);await c.waitForDeployment();return c;};
const token=await deploy({abi:mock.abi,bytecode:'0x'+mock.evm.bytecode.object});
const hasher=await deploy(artifacts.poseidon),verifier=await deploy(artifacts.verifier);
const pool=await deploy(artifacts.pool,[await token.getAddress(),await hasher.getAddress(),await verifier.getAddress()]);
for(const [name,contract] of [['pool',pool],['poseidon',hasher],['verifier',verifier]]){let code=await provider.getCode(await contract.getAddress());for(const {start,length} of artifacts[name].immutables){const a=2+start*2;code=code.slice(0,a)+'0'.repeat(length*2)+code.slice(a+length*2);}assert.equal(code,artifacts[name].runtime,`${name} runtime matches release`);}
const hash=(a,b)=>poseidon2([BigInt(a),BigInt(b)]);
const leaves=[];
function path(index){let layer=[...leaves],cursor=index,zero=0n;const siblings=[],pathIndices=[];for(let d=0;d<16;d++){siblings.push((layer[cursor^1]??zero).toString());pathIndices.push(cursor%2);const next=[];for(let i=0;i<layer.length;i+=2)next.push(hash(layer[i],layer[i+1]??zero));layer=next;zero=hash(zero,zero);cursor=Math.floor(cursor/2);}return {root:layer[0].toString(),siblings,pathIndices};}
const value=parseEther('0.01');
await(await token.mint(ownerAddress,value*10n)).wait();
await(await token.approve(await pool.getAddress(),value*10n)).wait();
const pre=hash(123n,456n);
await(await pool.depositWstETH(value,pre)).wait();leaves.push(hash(value,pre));
assert.equal(await pool.root(),BigInt(path(0).root));
assert.equal(await pool.liabilities(),value);
await assert.rejects(pool.depositWstETH.staticCall(value,pre),'duplicate precommitment');
await assert.rejects(pool.depositWstETH.staticCall(parseEther('0.11'),hash(9n,10n)),'deposit cap');
const ethValue=parseEther('0.012'),shares=ethValue*5n/6n,pre2=hash(789n,999n);
await assert.rejects(pool.depositETH.staticCall(pre2,ethValue,{value:ethValue}),'minimum shares');
await(await pool.depositETH(pre2,shares,{value:ethValue})).wait();leaves.push(hash(shares,pre2));
assert.equal(await pool.root(),BigInt(path(1).root));
assert.equal(await pool.liabilities(),value+shares);
assert.deepEqual(Array.from(await pool.getLeaves(0,256)),leaves);
const deadline=(await provider.getBlock('latest')).timestamp+3600;
const exit={recipient:recipientAddress,relayer:await submitter.getAddress(),fee:12345n,deadline};
const input={...path(0),nullifierHash:hash(123n,0n).toString(),value:value.toString(),context:(await pool.contextHash(exit)).toString(),mode:0,exposedCommitment:'0',nullifier:'123',secret:'456'};
await mkdir('work/zk',{recursive:true});await writeFile('work/zk/browser-witness.json',JSON.stringify(input));
async function prove(witness){const result=await groth16.fullProve(witness,'public/zk/withdraw.wasm','public/zk/withdraw.zkey',undefined,undefined,{singleThread:true});assert(await groth16.verify(JSON.parse(await readFile('public/zk/verification_key.json','utf8')),result.publicSignals,result.proof));return JSON.parse('['+await groth16.exportSolidityCallData(result.proof,result.publicSignals)+']');}
console.log('Real deployments, ETH conversion, token deposits, Merkle roots and deposit guards passed. Generating private-exit proof…');
const proof=await prove(input);
assert.equal(proof[3].length,7);
await assert.rejects(pool.withdraw.staticCall(...proof,{...exit,recipient:ownerAddress}),'recipient binding');
await assert.rejects(pool.withdraw.staticCall(...proof,{...exit,deadline:deadline+1}),'deadline binding');
await assert.rejects(pool.withdraw.staticCall(...proof,{...exit,fee:1}),'fee binding');
for(const signal of [0,1,2,3,4,5,6]){const mutated=structuredClone(proof);mutated[3][signal]=(BigInt(mutated[3][signal])+1n).toString();await assert.rejects(pool.withdraw.staticCall(...mutated,exit),`public signal ${signal} binding`);}
await assert.rejects(pool.withdraw.staticCall(...proof,exit),'designated relayer restriction');
await(await pool.connect(submitter).withdraw(...proof,exit)).wait();
assert.equal(await token.balanceOf(recipientAddress),value-exit.fee);
assert.equal(await token.balanceOf(await submitter.getAddress()),exit.fee);
assert.equal(await pool.spent(hash(123n,0n)),true);
await assert.rejects(pool.withdraw.staticCall(...proof,exit),'double spend');
console.log('Private withdrawal, recipient/context/proof tampering, and double-spend rejection passed. Generating public-exit proof…');
const publicExit={...exit,recipient:ownerAddress,relayer:ZeroAddress,fee:0};
const publicProof=await prove({...path(1),nullifierHash:hash(789n,0n).toString(),value:shares.toString(),context:(await pool.contextHash(publicExit)).toString(),mode:1,exposedCommitment:leaves[1].toString(),nullifier:'789',secret:'999'});
await assert.rejects(pool.connect(submitter).withdraw.staticCall(...publicProof,publicExit),'public exit owner restriction');
await(await pool.withdraw(...publicProof,publicExit)).wait();
assert.equal(await pool.liabilities(),0n);assert.equal(await token.balanceOf(await pool.getAddress()),0n);
assert.equal(await pool.spent(hash(789n,0n)),true);
console.log('Public exit ownership, nullifiers and exact token conservation passed. Full EVM + Groth16 flow verified.');
const forbidden=ganache.provider({logging:{quiet:true},chain:{chainId:1,hardfork:'shanghai'}});
const forbiddenProvider=new BrowserProvider(forbidden);
const forbiddenFactory=new ContractFactory(artifacts.pool.abi,artifacts.pool.bytecode,await forbiddenProvider.getSigner());
await assert.rejects(forbiddenFactory.deploy(await token.getAddress(),await hasher.getAddress(),await verifier.getAddress()),'mainnet constructor rejection');
await forbidden.disconnect();console.log('Mainnet deployment rejected.');
await transport.disconnect();process.exit(0);
