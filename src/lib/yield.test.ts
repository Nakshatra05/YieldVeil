import {describe,it,expect} from 'vitest';
import {newNote,exitContext} from './chain';
import {noteYield} from './yield';
import {mergeNotes} from './notes';
const pool='0x1111111111111111111111111111111111111111',owner='0x2222222222222222222222222222222222222222';
describe('yield and backup recovery',()=>{
 it('uses deposit shares and historical rate, preserving negative rate changes',()=>{
  const note={...newNote(pool,owner),value:'100000000000000000',depositRate:'1200000000000000000'};
  expect(noteYield(note,1250000000000000000n)).toEqual({initial:120000000000000000n,current:125000000000000000n,earned:5000000000000000n});
  expect(noteYield(note,1100000000000000000n)?.earned).toBe(-10000000000000000n);
  expect(noteYield({...note,depositRate:undefined},1250000000000000000n)).toBeNull();
 });
 it('merges backups without duplicating ownership, dropping a receipt, or changing secrets',()=>{
  const n=newNote(pool,owner),txHash='0x'+'a'.repeat(64);
  expect(mergeNotes([n],[{...n,txHash}])[0].txHash).toBe(txHash);
  expect(mergeNotes([n],[{...n,id:'another-id'}])).toHaveLength(1);
  expect(()=>mergeNotes([n],[{...newNote(pool,owner),id:n.id}])).toThrow();
 });
 it('binds recipient, relay identity and fee to proof context',()=>{
  const c=exitContext(560048,pool,owner,123,owner,10n);
  expect(exitContext(560048,pool,owner,123,pool,10n)).not.toBe(c);
  expect(exitContext(560048,pool,owner,123,owner,11n)).not.toBe(c);
 });
});
