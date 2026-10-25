import {Contract, Interface, type Provider} from 'ethers';
import {POOL_ABI, allLeaves, hash2} from './chain';
import {matchesRuntime, validDeployment, type Artifacts, type Deployment} from './deployment';
import type {UsdcNote} from './usdc-notes';
export const BASE={id:84532,name:'Base Sepolia',token:'0x036CbD53842c5426634e7929541eC2318f3dCF7e',rpc:'https://sepolia.base.org',explorer:'https://sepolia.basescan.org'};
export const USDC_ABI=['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)','function decimals() view returns(uint8)'];
export const USDC_POOL_ABI=[...POOL_ABI,'function depositUSDC(uint256,uint256) returns(uint256)'];
export async function loadUsdcDeployment():Promise<Deployment>{const r=await fetch('/usdc-deployment.json',{cache:'no-store'});if(!r.ok)throw Error('USDC deployment is not available.');const d:unknown=await r.json();if(!validDeployment(d))throw Error('Invalid USDC deployment.');return d;}
export async function verifyUsdc(provider:Provider,d:Deployment){
 if((await provider.getNetwork()).chainId!==84532n)throw Error('Switch to Base Sepolia.');
 const r=await fetch('/contracts/usdc.json');if(!r.ok)throw Error('USDC contract artifacts unavailable.');const artifacts:Artifacts=await r.json();
 await Promise.all((['pool','verifier','poseidon'] as const).map(async n=>{if(!matchesRuntime(await provider.getCode(d[n]),artifacts[n]))throw Error('USDC deployment bytecode mismatch.');}));
 const pool=new Contract(d.pool,USDC_POOL_ABI,provider);
 const [asset,verifier,hasher,decimals]=await Promise.all([pool.asset(),pool.verifier(),pool.hasher(),new Contract(BASE.token,USDC_ABI,provider).decimals()]);
 if(asset.toLowerCase()!==BASE.token.toLowerCase()||verifier.toLowerCase()!==d.verifier.toLowerCase()||hasher.toLowerCase()!==d.poseidon.toLowerCase()||decimals!==6n)throw Error('USDC pool dependencies mismatch.');
 return pool;
}
export async function reconcileUsdc(notes:UsdcNote[],pool:Contract):Promise<UsdcNote[]>{
 const leaves=await allLeaves(pool),address=(await pool.getAddress()).toLowerCase();
 return Promise.all(notes.map(async n=>{if(n.pool.toLowerCase()!==address) return n;const index=leaves.findIndex(v=>v.toString()===n.commitment);if(index<0){if(n.status!=='pending')throw Error('A confirmed note is missing from the configured pool.');return n;}return {...n,index,status:await pool.spent(hash2(n.nullifier,0n))?'spent':'active'};}));
}
export function parseUsdcDeposit(logs:readonly {address:string;topics:readonly string[];data:string}[],n:UsdcNote):UsdcNote{
 const iface=new Interface(USDC_POOL_ABI);
 for(const log of logs){if(log.address.toLowerCase()!==n.pool.toLowerCase())continue;try{const e=iface.parseLog({topics:[...log.topics],data:log.data});if(e?.name==='Deposited'&&e.args.precommitment.toString()===n.precommitment&&e.args.commitment.toString()===n.commitment&&e.args.value.toString()===n.value)return {...n,index:Number(e.args.leafIndex),status:'active'};}catch{/* unrelated event */}}
 throw Error('Deposit receipt does not match the backed-up note. Restore and reconcile before retrying.');
}
export function proveUsdc(input:Record<string,unknown>,progress:(s:string)=>void):Promise<unknown[]>{return new Promise((resolve,reject)=>{const worker=new Worker(new URL('../workers/prover.worker.ts',import.meta.url),{type:'module'});worker.onmessage=e=>{if(e.data.progress)progress(e.data.progress);if(e.data.ok===true){worker.terminate();resolve(e.data.calldata);}if(e.data.ok===false){worker.terminate();reject(Error(e.data.error));}};worker.onerror=()=>{worker.terminate();reject(Error('Proof worker failed. Your note is unchanged.'));};worker.postMessage(input);});}
