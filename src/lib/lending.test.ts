import {describe,it,expect} from 'vitest';
import {newLendingNote,sealNotes,openNotes,mergeNotes,NOTE_STORAGE} from './lending-notes';
import {newUsdcNote,sealNotes as sealUsdc,openNotes as openUsdc,NOTE_STORAGE as USDC_STORAGE} from './usdc-notes';
import {newNote,hash2} from './chain';
import {sealNotes as sealHoodi,openNotes as openHoodi,NOTE_STORAGE as HOODI_STORAGE} from './notes';
import {netGrowth,reconcileLending} from './lending';
import type {Contract} from 'ethers';
const pool='0x1111111111111111111111111111111111111111',owner='0x2222222222222222222222222222222222222222',pass='test recovery phrase';
describe('lending recovery and actual valuation',()=>{
 it('keeps all three backup formats isolated and legacy files readable',async()=>{
  const n=newLendingNote(pool,owner,'100000'),u=newUsdcNote(pool,owner,'100000'),h=newNote(pool,owner);
  const [nb,ub,hb]=await Promise.all([sealNotes([n],pass),sealUsdc([u],pass),sealHoodi([h],pass)]);
  expect(new Set([NOTE_STORAGE,USDC_STORAGE,HOODI_STORAGE]).size).toBe(3);
  expect(await openNotes(nb,pass)).toEqual([n]);expect(await openUsdc(ub,pass)).toEqual([u]);expect(await openHoodi(hb,pass)).toEqual([h]);
  await expect(openNotes(ub,pass)).rejects.toThrow();await expect(openNotes(hb,pass)).rejects.toThrow();await expect(openUsdc(nb,pass)).rejects.toThrow();
 });
 it('recovers minted shares and canonical principal from a pre-deposit backup',async()=>{
  const n=newLendingNote(pool,owner,'100000');const shares=99998000000n;
  const fake={getAddress:async()=>pool,depositInfo:async()=>({shares,assets:100000n,blockNumber:99n}),spent:async()=>false} as unknown as Contract;
  const [recovered]=await reconcileLending([n],fake);expect(recovered.value).toBe(shares.toString());expect(recovered.commitment).toBe(hash2(shares,n.precommitment).toString());expect(recovered.status).toBe('active');
  expect(mergeNotes([{...recovered,status:'spent'}],[n])[0].status).toBe('spent');
  expect((await reconcileLending([{...recovered,assetsDeposited:'1'}],fake))[0].assetsDeposited).toBe('100000');
  await expect(reconcileLending([{...recovered,value:'1'}],fake)).rejects.toThrow();
 });
 it('never invents an APY, conceals losses or substitutes missing values',()=>{
  const n=newLendingNote(pool,owner,'100000');expect(netGrowth([n],null)).toBeNull();expect(netGrowth([n],{})).toBeNull();
  expect(netGrowth([n],{[n.id]:'99998'})).toBe(-2n);expect(netGrowth([n],{[n.id]:'100000'})).toBe(0n);expect(netGrowth([n],{[n.id]:'100007'})).toBe(7n);
 });
});
