import {describe,it,expect} from 'vitest';
import {signRoute,validRoute,routeInstruction} from './route-core.mjs';
const q={kind:'route-v1',chainId:560048,pool:'pool',factory:'factory',router:'router',recipient:'recipient',relayer:'relayer',nullifierHash:'1',value:'10000',gross:'5000',fee:'100',changePrecommitment:'123',minimum:'4800',expectedOutput:'4900',output:1,deadline:100,nonce:1,gasPrice:'1200000000',gasLimit:'1700000'};
describe('atomic route quotes',()=>{
 it('authenticates change secrets, output, slippage and execution address as well as fees',()=>{const signed={...q,signature:signRoute(q,'test-key')};expect(validRoute(signed,'test-key')).toBe(true);for(const key of Object.keys(q))expect(validRoute({...signed,[key]:String(q[key])+'1'},'test-key')).toBe(false);});
 it('passes only the immutable execution instructions to the factory',()=>{expect(routeInstruction(q)).toEqual({recipient:q.recipient,relayer:q.relayer,gross:q.gross,fee:q.fee,changePrecommitment:q.changePrecommitment,minimum:q.minimum,deadline:q.deadline,output:q.output});});
});
