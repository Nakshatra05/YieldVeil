import { AbiCoder, BrowserProvider, Contract, Interface, ZeroAddress, keccak256 } from 'ethers';
import { poseidon2 } from 'poseidon-lite/poseidon2';
export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const NETWORKS = {
  testnet: { id: 560048, name: 'Hoodi testnet', token: '0x7E99eE3C66636DE415D2d7C880938F2f40f94De4', explorer: 'https://hoodi.etherscan.io', rpc: 'https://ethereum-hoodi-rpc.publicnode.com' },
  mainnet: { id: 1, name: 'Ethereum mainnet', token: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', explorer: 'https://etherscan.io', rpc: 'https://ethereum-rpc.publicnode.com' },
} as const;
export type Environment = keyof typeof NETWORKS;
export type Injected = { request: (args:{method:string;params?:unknown[]})=>Promise<unknown>; on?:(e:string,fn:(...args:unknown[])=>void)=>void; removeListener?:(e:string,fn:(...args:unknown[])=>void)=>void };
export const walletProvider = () => (window as Window & {ethereum?:Injected}).ethereum;
export const TOKEN_ABI = ['function balanceOf(address) view returns(uint256)','function stEthPerToken() view returns(uint256)','function approve(address,uint256) returns(bool)'];
export const POOL_ABI = [
 'function hasher() view returns(address)','function asset() view returns(address)','function verifier() view returns(address)','function root() view returns(uint256)', 'function liabilities() view returns(uint256)', 'function leafCount() view returns(uint256)',
 'function getLeaves(uint256,uint256) view returns(uint256[])','function spent(uint256) view returns(bool)',
 'function depositETH(uint256,uint256) payable returns(uint256)','function depositWstETH(uint256,uint256) returns(uint256)',
 'function withdraw(uint256[2],uint256[2][2],uint256[2],uint256[7],(address recipient,address relayer,uint256 fee,uint256 deadline))',
 'event Deposited(address indexed account,uint256 indexed commitment,uint256 value,uint256 leafIndex,uint256 precommitment)',
 'event Withdrawn(uint256 indexed nullifierHash,address indexed recipient,uint256 value,uint256 fee,uint256 mode)',
];
export type ChainNote = { id:string; chainId:560048; pool:string; depositor:string; nullifier:string; secret:string; precommitment:string; commitment?:string; value?:string; index?:number; txHash?:string; withdrawalTx?:string; kind?:'change'; basisBlock?:number; originNullifier?:string; depositBlock?:number; depositRate?:string; depositTimestamp?:number; status:'pending'|'active'|'spent'; createdAt:number };
export const hash2 = (a:bigint|string,b:bigint|string) => poseidon2([BigInt(a),BigInt(b)]);
function secretField():string { let n:bigint; do { n=BigInt('0x'+Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')); } while(n===0n||n>=FIELD); return n.toString(); }
export function newNote(pool:string,depositor:string):ChainNote { const nullifier=secretField(), secret=secretField(); return {id:crypto.randomUUID(),chainId:560048,pool,depositor,nullifier,secret,precommitment:hash2(nullifier,secret).toString(),status:'pending',createdAt:Date.now()}; }
export function merklePath(leaves:bigint[],index:number) {
  if(index<0||index>=leaves.length||leaves.length>65536) throw new Error('Note is not in the confirmed tree.');
  const siblings:string[]=[],pathIndices:number[]=[]; let level=leaves.slice(),zero=0n,cursor=index;
  for(let d=0;d<16;d++) { siblings.push((level[cursor^1]??zero).toString()); pathIndices.push(cursor%2); const next:bigint[]=[]; for(let i=0;i<level.length;i+=2) next.push(hash2(level[i],level[i+1]??zero)); level=next; zero=hash2(zero,zero); cursor=Math.floor(cursor/2); }
  return {root:(level[0]??zero).toString(),siblings,pathIndices};
}
export async function allLeaves(pool:Contract):Promise<bigint[]> { const count=Number(await pool.leafCount()); if(count>65536) throw new Error('Unsupported tree size.'); const leaves:bigint[]=[]; for(let from=0;from<count;from+=256) leaves.push(...await pool.getLeaves(from,Math.min(256,count-from))); return leaves; }
export function exitContext(chainId:number,pool:string,recipient:string,deadline:number,relayer=ZeroAddress,fee:bigint=0n) { return BigInt(keccak256(AbiCoder.defaultAbiCoder().encode(['uint256','address','address','address','uint256','uint256'],[chainId,pool,recipient,relayer,fee,deadline])))%FIELD; }
export async function chainConnection(expected:Environment) {
  const injected=walletProvider(); if(!injected) throw new Error('Open Yieldveil in a browser with an Ethereum wallet installed.');
  const id=Number(BigInt(await injected.request({method:'eth_chainId'}) as string));
  if(id!==NETWORKS[expected].id) throw new Error(`Switch your wallet to ${NETWORKS[expected].name}.`);
  const provider=new BrowserProvider(injected); const signer=await provider.getSigner(); return {provider,signer,address:await signer.getAddress()};
}
export function parseDeposit(logs:readonly {topics:readonly string[];data:string;address?:string}[],note:ChainNote):ChainNote {
  const iface=new Interface(POOL_ABI);
  for(const log of logs) { if(log.address&&log.address.toLowerCase()!==note.pool.toLowerCase())continue; try { const e=iface.parseLog({topics:[...log.topics],data:log.data}); if(e?.name==='Deposited'&&e.args.precommitment.toString()===note.precommitment) return {...note,value:e.args.value.toString(),commitment:e.args.commitment.toString(),index:Number(e.args.leafIndex),status:'active'}; } catch { /* Different event. */ } }
  throw new Error('Deposit event missing. Keep your backup and transaction hash for recovery.');
}
