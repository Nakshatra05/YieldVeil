import {Contract, isAddress, type Provider} from 'ethers';
import {NETWORKS,POOL_ABI} from './chain';
export type Deployment={pool:string;verifier:string;poseidon:string;block:number};
type Artifact={abi:ConstructorParameters<typeof Contract>[1];bytecode:string;runtime:string;immutables:{start:number;length:number}[]};
export type Artifacts=Record<'pool'|'verifier'|'poseidon',Artifact>;
export function validDeployment(d:unknown):d is Deployment {const v=d as Deployment;return !!v&&isAddress(v.pool)&&isAddress(v.verifier)&&isAddress(v.poseidon)&&Number.isSafeInteger(v.block)&&v.block>=0;}
export async function loadArtifacts():Promise<Artifacts>{const r=await fetch('/contracts/artifacts.json');if(!r.ok)throw new Error('Contract artifacts unavailable.');return r.json();}
export function matchesRuntime(code:string,artifact:Artifact){if(code.length!==artifact.runtime.length)return false;let normalized=code.toLowerCase();for(const {start,length} of artifact.immutables){const a=2+start*2;normalized=normalized.slice(0,a)+'0'.repeat(length*2)+normalized.slice(a+length*2);}return normalized===artifact.runtime.toLowerCase();}
export async function verifyDeployment(provider:Provider,d:Deployment){
 if(!validDeployment(d))throw new Error('Invalid deployment manifest.');
 const artifacts=await loadArtifacts();
 await Promise.all((['pool','verifier','poseidon'] as const).map(async name=>{if(!matchesRuntime(await provider.getCode(d[name]),artifacts[name]))throw new Error(`${name} bytecode does not match this release.`);}));
 const pool=new Contract(d.pool,POOL_ABI,provider);const [asset,verifier,hasher]=await Promise.all([pool.asset(),pool.verifier(),pool.hasher()]);
 if(asset.toLowerCase()!==NETWORKS.testnet.token.toLowerCase()||verifier.toLowerCase()!==d.verifier.toLowerCase()||hasher.toLowerCase()!==d.poseidon.toLowerCase())throw new Error('Pool dependencies do not match.');
 return pool;
}
