import {describe,it,expect} from 'vitest';
import {newUsdcNote,sealNotes,openNotes,validateNotes,mergeNotes,NOTE_STORAGE} from './usdc-notes';
import {newNote} from './chain';
import {sealNotes as sealHoodi,openNotes as openHoodi,NOTE_STORAGE as HOODI_STORAGE} from './notes';
const pool='0x1111111111111111111111111111111111111111',owner='0x2222222222222222222222222222222222222222',pass='test recovery phrase';
describe('isolated Circle USDC backups',()=>{
 it('keeps both legacy Hoodi backups and Base backups readable only in their own vault',async()=>{
  const h=newNote(pool,owner),u=newUsdcNote(pool,owner,'100000');const hb=await sealHoodi([h],pass),ub=await sealNotes([u],pass);
  expect(NOTE_STORAGE).not.toBe(HOODI_STORAGE);expect(await openHoodi(hb,pass)).toEqual([h]);expect(await openNotes(ub,pass)).toEqual([u]);
  await expect(openNotes(hb,pass)).rejects.toThrow();await expect(openHoodi(ub,pass)).rejects.toThrow();await expect(openNotes(ub,'wrong password')).rejects.toThrow();
 });
 it('validates six-decimal amounts and pending commitment before funds are deposited',()=>{
  const n=newUsdcNote(pool,owner,'100000');validateNotes([n]);expect(()=>validateNotes([{...n,value:'100001'}])).toThrow();expect(()=>validateNotes([newUsdcNote(pool,owner,'100000001')])).toThrow();expect(()=>validateNotes([{...n,chainId:560048}])).toThrow();
 });
 it('merges older backups without losing spent states or accepting conflicting identities',()=>{
  const n=newUsdcNote(pool,owner,'100000');expect(mergeNotes([{...n,status:'spent'}],[n])[0].status).toBe('spent');expect(()=>mergeNotes([n],[{...n,pool:owner}])).toThrow();
 });
});
