import {describe,it,expect} from 'vitest';
import {signQuote,validQuote,validateProof,validateRequest,context,CHAIN,POOL} from './usdc-core.mjs';
import {signQuote as hoodiSign} from './relay-core.mjs';
const key='test-key-not-a-wallet';
const q={chainId:CHAIN,pool:POOL,recipient:'0x1111111111111111111111111111111111111111',relayer:'0x2222222222222222222222222222222222222222',nullifierHash:'5',value:'100000',fee:'10000',deadline:9999999999,nonce:1,gasPrice:'20000000',gasLimit:'550000'};
describe('Base USDC relay authorization',()=>{
 it('domain-separates quotes and binds recipient, amount, fee, network and nonce',()=>{const signed={...q,signature:signQuote(q,key)};expect(validQuote(signed,key)).toBe(true);expect(validQuote({...signed,signature:hoodiSign(q,key)},key)).toBe(false);for(const field of ['chainId','pool','recipient','relayer','nullifierHash','value','fee','deadline','nonce','gasPrice','gasLimit'])expect(validQuote({...signed,[field]:String(q[field])+'1'},key)).toBe(false);});
 it('rejects wrong proof context, public mode, fee and excess amounts',()=>{const proof=[['1','2'],[['1','2'],['1','2']],['1','2'],['0','1','5','100000',context(q).toString(),'0','0']];expect(()=>validateProof(proof,q)).not.toThrow();expect(()=>validateProof(proof,{...q,fee:'10001'})).toThrow();expect(()=>validateProof([...proof.slice(0,3),[...proof[3].slice(0,5),'1','0']],q)).toThrow();expect(()=>validateRequest({...q,value:'100000001'})).toThrow();});
});
