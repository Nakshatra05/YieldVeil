import {AbiCoder,Contract,Interface,keccak256,type Provider} from 'ethers';
import {FIELD,POOL_ABI,hash2} from './chain';
import {BASE,USDC_ABI} from './usdc';
import {matchesRuntime,validDeployment,type Artifacts,type Deployment} from './deployment';
import type {LendingNote} from './lending-notes';
import type {RelayQuote} from './relay';
export {BASE,USDC_ABI,proveUsdc} from './usdc';
export const COMET='0x571621Ce60Cebb0c1D442B5afb38B1663C6Bf017';
export type LendingQuote=RelayQuote&{minimumAssets:string;quotedAssets:string};
export const LENDING_ABI=[...POOL_ABI.filter(s=>!s.startsWith('function withdraw(')&&!s.startsWith('function deposit')), 'function market() view returns(address)','function ownedPrincipal() view returns(uint256)','function accountedAssets() view returns(uint256)','function depositUSDC(uint256,uint256,uint256) returns(uint256)','function depositInfo(uint256) view returns(uint256 shares,uint256 assets,uint256 blockNumber)','function previewDeposit(uint256) returns(uint256)','function previewRedeem(uint256) returns(uint256 assets,uint256 cash,bool paused)','function withdraw(uint256[2],uint256[2][2],uint256[2],uint256[7],(address recipient,address relayer,uint256 fee,uint256 deadline,uint256 minimumAssets))','event AssetsWithdrawn(uint256 indexed nullifierHash,uint256 assets,uint256 received,uint256 fee)'];
export async function loadLendingDeployment():Promise<Deployment>{const r=await fetch('/lending-deployment.json',{cache:'no-store'});if(!r.ok)throw Error('Lending pool is not available.');const d=await r.json();if(!validDeployment(d))throw Error('Invalid lending deployment.');return d;}
export async function verifyLending(provider:Provider,d:Deployment){
 if((await provider.getNetwork()).chainId!==84532n)throw Error('Switch to Base Sepolia.');
 const r=await fetch('/contracts/compound.json');if(!r.ok)throw Error('Lending artifacts unavailable.');const artifacts:Artifacts=await r.json();
 await Promise.all((['pool','verifier','poseidon'] as const).map(async n=>{if(!matchesRuntime(await provider.getCode(d[n]),artifacts[n]))throw Error('Lending contract bytecode mismatch.');}));
 const pool=new Contract(d.pool,LENDING_ABI,provider);const [asset,verifier,hasher,market,decimals]=await Promise.all([pool.asset(),pool.verifier(),pool.hasher(),pool.market(),new Contract(BASE.token,USDC_ABI,provider).decimals()]);
 if(asset.toLowerCase()!==BASE.token.toLowerCase()||verifier.toLowerCase()!==d.verifier.toLowerCase()||hasher.toLowerCase()!==d.poseidon.toLowerCase()||market.toLowerCase()!==COMET.toLowerCase()||decimals!==6n)throw Error('Lending pool dependencies mismatch.');
 const underlying=await new Contract(COMET,['function baseToken() view returns(address)'],provider).baseToken();if(underlying.toLowerCase()!==BASE.token.toLowerCase())throw Error('Compound underlying asset changed.');return pool;
}
export async function reconcileLending(notes:LendingNote[],pool:Contract):Promise<LendingNote[]>{
 const address=(await pool.getAddress()).toLowerCase();return Promise.all(notes.map(async n=>{
  if(n.pool.toLowerCase()!==address)return n;const info=await pool.depositInfo(n.precommitment);
  if(info.shares===0n){if(n.status!=='pending')throw Error('Confirmed lending note missing from pool.');return n;}
  const commitment=hash2(info.shares,n.precommitment).toString();if(n.status!=='pending'&&(n.value!==info.shares.toString()||n.commitment!==commitment))throw Error('Lending note commitment does not match the chain.');
  return {...n,value:info.shares.toString(),assetsDeposited:info.assets.toString(),commitment,depositBlock:Number(info.blockNumber),status:await pool.spent(hash2(n.nullifier,0n))?'spent':'active'};
 }));
}
export function parseLendingDeposit(logs:readonly {address:string;topics:readonly string[];data:string}[],n:LendingNote):LendingNote{const iface=new Interface(LENDING_ABI);for(const log of logs){if(log.address.toLowerCase()!==n.pool.toLowerCase())continue;try{const e=iface.parseLog({topics:[...log.topics],data:log.data});if(e?.name==='Deposited'&&e.args.precommitment.toString()===n.precommitment)return {...n,value:e.args.value.toString(),commitment:e.args.commitment.toString(),index:Number(e.args.leafIndex),status:'active'};}catch{/* unrelated log */}}throw Error('Deposit receipt missing. Restore your backup and reconcile.');}
export function lendingContext(pool:string,recipient:string,deadline:number,relayer:string,fee:bigint,minimumAssets:bigint){return BigInt(keccak256(AbiCoder.defaultAbiCoder().encode(['uint256','address','address','address','uint256','uint256','uint256'],[84532,pool,recipient,relayer,fee,deadline,minimumAssets])))%FIELD;}
export async function readLendingValues(pool:Contract,notes:LendingNote[]){const entries=await Promise.all(notes.filter(n=>n.status==='active').map(async n=>{const [value]=await pool.previewRedeem.staticCall(n.value);return [n.id,value.toString()] as const;}));return Object.fromEntries(entries);}
export function netGrowth(notes:LendingNote[],values:Record<string,string>|null):bigint|null{if(!values||notes.some(n=>values[n.id]===undefined))return null;return notes.reduce((sum,n)=>sum+BigInt(values[n.id])-BigInt(n.assetsDeposited),0n);}
