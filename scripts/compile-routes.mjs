import solc from 'solc';
import {readFile,writeFile} from 'node:fs/promises';
const source=await readFile('contracts/ExitRouter.sol','utf8');
const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'ExitRouter.sol':{content:source}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.deployedBytecode.immutableReferences']}}}})));
for(const error of output.errors??[])if(error.severity==='error')throw Error(error.formattedMessage);
const artifacts={};for(const name of ['HoodiEthReserve','ExitRouterFactory','NoteExit']){const c=output.contracts['ExitRouter.sol'][name];artifacts[name]={abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,runtime:'0x'+c.evm.deployedBytecode.object,immutables:Object.values(c.evm.deployedBytecode.immutableReferences??{}).flat()};}
await writeFile('public/contracts/routes.json',JSON.stringify(artifacts));
console.log('Compiled atomic exit routes. Legacy pool and proving artifacts unchanged.');
