import {Contract,type Provider} from 'ethers';
import {matchesRuntime,type Artifacts} from './deployment';
import {NETWORKS} from './chain';
import type {RouteQuote} from './relay';
export type Routes={factory:string;reserve:string;implementation:string;block:number};
export const ROUTE_TUPLE='(address recipient,address relayer,uint256 gross,uint256 fee,uint256 changePrecommitment,uint256 minimum,uint256 deadline,uint8 output)';
export const FACTORY_ABI=[`function predict(uint256,${ROUTE_TUPLE}) view returns(address)`,'function implementation() view returns(address)','function pool() view returns(address)','function asset() view returns(address)','function reserve() view returns(address)'];
export function routeInstruction(q:RouteQuote){return {recipient:q.recipient,relayer:q.relayer,gross:q.gross,fee:q.fee,changePrecommitment:q.changePrecommitment,minimum:q.minimum,deadline:q.deadline,output:q.output};}
export async function verifyRoute(provider:Provider,pool:string,q:RouteQuote){
 const [configResponse,artifactResponse]=await Promise.all([fetch('/routes.json',{cache:'no-store'}),fetch('/contracts/routes.json')]);
 if(!configResponse.ok||!artifactResponse.ok)throw new Error('Exit routes are unavailable. Full wstETH exits remain available.');
 const config:Routes=await configResponse.json(),artifacts:Record<string,Artifacts['pool']>=await artifactResponse.json();
 if(config.factory.toLowerCase()!==q.factory.toLowerCase())throw new Error('Unknown exit router.');
 await Promise.all(([['ExitRouterFactory',config.factory],['HoodiEthReserve',config.reserve],['NoteExit',config.implementation]] as const).map(async([name,address])=>{if(!matchesRuntime(await provider.getCode(address),artifacts[name]))throw new Error('Exit bytecode verification failed.');}));
 const factory=new Contract(config.factory,FACTORY_ABI,provider);
 const reserve=new Contract(config.reserve,['function asset() view returns(address)'],provider);
 if((await reserve.asset()).toLowerCase()!==NETWORKS.testnet.token.toLowerCase())throw new Error('Reserve asset mismatch.');
 const implementation=new Contract(config.implementation,[...FACTORY_ABI,'function factory() view returns(address)'],provider);
 const [p,t,r,i,ip,it,ir,f,predicted]=await Promise.all([factory.pool(),factory.asset(),factory.reserve(),factory.implementation(),implementation.pool(),implementation.asset(),implementation.reserve(),implementation.factory(),factory.predict(q.nullifierHash,routeInstruction(q))]);
 if(p.toLowerCase()!==pool.toLowerCase()||ip.toLowerCase()!==pool.toLowerCase()||t.toLowerCase()!==NETWORKS.testnet.token.toLowerCase()||it.toLowerCase()!==t.toLowerCase()||r.toLowerCase()!==config.reserve.toLowerCase()||ir.toLowerCase()!==r.toLowerCase()||i.toLowerCase()!==config.implementation.toLowerCase()||f.toLowerCase()!==config.factory.toLowerCase()||predicted.toLowerCase()!==q.router.toLowerCase())throw new Error('Exit instructions do not match the verified route.');
}
