import {describe,it,expect} from 'vitest';
import {hash2,merklePath,newNote,exitContext,FIELD} from './chain';
import {sealNotes,openNotes,validateNotes} from './notes';
import {matchesRuntime} from './deployment';
const pool='0x1111111111111111111111111111111111111111';
const owner='0x2222222222222222222222222222222222222222';
describe('real note cryptography',()=>{
 it('reconstructs the same root from each odd-sized tree membership path',()=>{const leaves=[1n,2n,3n,4n,5n].map(n=>hash2(n,n+1n));const roots=leaves.map((leaf,index)=>{const p=merklePath(leaves,index);let n=leaf;for(let d=0;d<16;d++)n=p.pathIndices[d]?hash2(p.siblings[d],n):hash2(n,p.siblings[d]);expect(n.toString()).toBe(p.root);return p.root;});expect(new Set(roots).size).toBe(1);});
 it('rejects absent membership',()=>{expect(()=>merklePath([],0)).toThrow();expect(()=>merklePath([1n],-1)).toThrow();expect(()=>merklePath([1n],1)).toThrow();});
 it('binds exits to chain, pool, recipient and deadline',()=>{const c=exitContext(560048,pool,owner,100);expect(c).toBeLessThan(FIELD);expect(exitContext(1,pool,owner,100)).not.toBe(c);expect(exitContext(560048,owner,owner,100)).not.toBe(c);expect(exitContext(560048,pool,pool,100)).not.toBe(c);expect(exitContext(560048,pool,owner,101)).not.toBe(c);});
 it('encrypts notes with fresh randomness and rejects wrong passwords or corrupt ciphertext',async()=>{const note=newNote(pool,owner),pass='a-long-test-passphrase';const a=await sealNotes([note],pass),b=await sealNotes([note],pass);expect(a).not.toBe(b);expect(a).not.toContain(note.secret);expect(await openNotes(a,pass)).toEqual([note]);await expect(openNotes(a,'incorrect password')).rejects.toThrow();const altered=JSON.parse(a);altered.data=(altered.data[0]==='A'?'B':'A')+altered.data.slice(1);await expect(openNotes(JSON.stringify(altered),pass)).rejects.toThrow();});
 it('rejects modified secrets, duplicated notes and invalid commitments',()=>{const n=newNote(pool,owner);expect(()=>validateNotes([{...n,secret:'0'}])).toThrow();expect(()=>validateNotes([n,n])).toThrow();expect(()=>validateNotes([{...n,status:'active',value:'100',commitment:'1'}])).toThrow();expect(()=>validateNotes([{...n,chainId:1}])).toThrow();});
 it('accepts a confirmed note only when its amount matches its commitment',()=>{const n=newNote(pool,owner),value='10000000000000000';validateNotes([{...n,value,commitment:hash2(value,n.precommitment).toString(),status:'active'}]);});
 it('matches contract bytecode while masking only declared immutables',()=>{const a={abi:[],bytecode:'0x00',runtime:'0x123400005678',immutables:[{start:2,length:2}]};expect(matchesRuntime('0x1234abcd5678',a)).toBe(true);expect(matchesRuntime('0x1234abcd5679',a)).toBe(false);expect(matchesRuntime('0x',a)).toBe(false);});
});
