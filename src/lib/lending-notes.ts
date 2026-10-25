import { hash2, FIELD, newNote, type ChainNote } from './chain';
export type LendingNote=Omit<ChainNote,'chainId'|'kind'|'originNullifier'|'basisBlock'|'depositRate'> & {chainId:84532;assetsDeposited:string};
export function newLendingNote(pool:string,depositor:string,value:string):LendingNote {return {...newNote(pool,depositor),chainId:84532,assetsDeposited:value};}
import { isAddress } from 'ethers';
export const NOTE_STORAGE = 'yieldveil.base-sepolia.compound.encrypted-notes.v1';
const bytesTo64=(b:Uint8Array)=>btoa(Array.from(b,x=>String.fromCharCode(x)).join(''));
const from64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function key(pass:string,salt:Uint8Array<ArrayBuffer>) { const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']); return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']); }
export function validateNotes(data:unknown):asserts data is LendingNote[] {
  if(!Array.isArray(data)||data.length>2000) throw new Error('Invalid backup.');
  const ids=new Set();
  for(const n of data) {
    if(!n||typeof n.id!=='string'||ids.has(n.id)||n.chainId!==84532||!isAddress(n.pool)||!isAddress(n.depositor)||!['pending','active','spent'].includes(n.status)) throw new Error('Invalid note identity.');
    ids.add(n.id);
    if(typeof n.assetsDeposited!=='string'||!/^\d{1,9}$/.test(n.assetsDeposited)||BigInt(n.assetsDeposited)<=0n||BigInt(n.assetsDeposited)>100000000n)throw new Error('Invalid USDC principal.');
    for(const f of ['nullifier','secret','precommitment']) if(typeof n[f]!=='string'||!/^\d{1,78}$/.test(n[f])||BigInt(n[f])<=0n||BigInt(n[f])>=FIELD) throw new Error('Invalid note secrets.');
    if(hash2(n.nullifier,n.secret).toString()!==n.precommitment) throw new Error('Note integrity check failed.');
    if(n.status!=='pending' && (typeof n.value!=='string'||!/^\d{1,30}$/.test(n.value)||BigInt(n.value)<=0n||BigInt(n.value)>100000000000000000n||hash2(n.value,n.precommitment).toString()!==n.commitment)) throw new Error('Invalid note commitment.');
    if(n.txHash!==undefined&&!/^0x[\da-fA-F]{64}$/.test(n.txHash)) throw new Error('Invalid transaction hash.');
    if(n.depositRate!==undefined&&(typeof n.depositRate!=='string'||!/^\d{1,30}$/.test(n.depositRate)||BigInt(n.depositRate)<=0n))throw new Error('Invalid historical rate.');
    for(const f of ['depositBlock','depositTimestamp','basisBlock'])if(n[f]!==undefined&&(!Number.isSafeInteger(n[f])||n[f]<0))throw new Error('Invalid deposit metadata.');
    if(n.kind!==undefined)throw new Error('Invalid note type.');
    if(n.originNullifier!==undefined&&(typeof n.originNullifier!=='string'||!/^\d{1,78}$/.test(n.originNullifier)||BigInt(n.originNullifier)>=FIELD))throw new Error('Invalid origin.');
    if(n.kind==='change'&&(!n.value||!/^\d{1,30}$/.test(n.value)||BigInt(n.value)<=0n||BigInt(n.value)>100000000000000000n||hash2(n.value,n.precommitment).toString()!==n.commitment))throw new Error('Invalid change note.');
  }
}
export function mergeNotes(existing:LendingNote[],incoming:LendingNote[]):LendingNote[]{
  validateNotes(existing);validateNotes(incoming);
  const merged=[...existing];
  for(const n of incoming){
    const index=merged.findIndex(e=>e.id===n.id||(e.pool.toLowerCase()===n.pool.toLowerCase()&&e.precommitment===n.precommitment));
    if(index<0){merged.push(n);continue;}
    const old=merged[index];
    if(old.chainId!==n.chainId||old.pool.toLowerCase()!==n.pool.toLowerCase()||old.secret!==n.secret||old.nullifier!==n.nullifier||old.depositor.toLowerCase()!==n.depositor.toLowerCase())throw new Error('Conflicting note identities. Existing notes were preserved.');
    merged[index]={...n,...old,txHash:old.txHash??n.txHash};
  }
  validateNotes(merged);return merged;
}
export async function sealNotes(notes:LendingNote[],pass:string) { if(pass.length<12) throw new Error('Use a passphrase with at least 12 characters.'); validateNotes(notes); const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)); const c=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(pass,salt),new TextEncoder().encode(JSON.stringify(notes))); return JSON.stringify({format:'yieldveil-compound-usdc-v1',salt:bytesTo64(salt),iv:bytesTo64(iv),data:bytesTo64(new Uint8Array(c))}); }
export async function openNotes(text:string,pass:string):Promise<LendingNote[]> { try { if(text.length>5e6) throw new Error(); const e=JSON.parse(text); if(e.format!=='yieldveil-compound-usdc-v1') throw new Error(); const salt=from64(e.salt),iv=from64(e.iv); if(salt.length!==16||iv.length!==12) throw new Error(); const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},await key(pass,salt),from64(e.data)); const notes:unknown=JSON.parse(new TextDecoder().decode(plain)); validateNotes(notes); return notes; } catch { throw new Error('Cannot unlock this backup. Check the file and passphrase.'); } }
export function download(text:string,name:string) { const url=URL.createObjectURL(new Blob([text],{type:'application/json'})); const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
