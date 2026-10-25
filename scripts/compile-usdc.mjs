import solc from 'solc';
import {poseidonContract} from 'circomlibjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const sources={};for(const file of ['YieldveilUsdcPool.sol','WithdrawalVerifier.sol'])sources[file]={content:await readFile('contracts/'+file,'utf8')};
const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.deployedBytecode.immutableReferences']}}}})));
for(const e of output.errors??[])if(e.severity==='error')throw new Error(e.formattedMessage);
const pick=(file,name)=>{const c=output.contracts[file][name];return {abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,runtime:'0x'+c.evm.deployedBytecode.object,immutables:Object.values(c.evm.deployedBytecode.immutableReferences??{}).flat()};};
const poseidonCode=poseidonContract.createCode(2);
// circomlibjs evmasm's loader starts CODESIZE PUSH1 <loader-length>.
if(!poseidonCode.startsWith('0x3860'))throw new Error('Unknown Poseidon deployment loader');
const loaderBytes=parseInt(poseidonCode.slice(6,8),16);
await mkdir('public/contracts',{recursive:true});
await writeFile('public/contracts/usdc.json',JSON.stringify({pool:pick('YieldveilUsdcPool.sol','YieldveilUsdcPool'),verifier:pick('WithdrawalVerifier.sol','Groth16Verifier'),poseidon:{abi:poseidonContract.generateABI(2),bytecode:poseidonCode,runtime:'0x'+poseidonCode.slice(2+loaderBytes*2),immutables:[]}}));
console.log('Compiled Base Sepolia USDC pool, verifier and Poseidon artifacts.');
