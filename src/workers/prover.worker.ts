import { groth16 } from 'snarkjs';
import type { CircuitSignals } from 'snarkjs';
self.onmessage=async(event:MessageEvent<CircuitSignals>)=>{
  try {
    self.postMessage({progress:'Computing the ownership proof…'});
    const result=await groth16.fullProve(event.data,'/zk/withdraw.wasm','/zk/withdraw.zkey',undefined,undefined,{singleThread:true});
    self.postMessage({progress:'Verifying the generated proof…'});
    const key=await fetch('/zk/verification_key.json').then(r=>{if(!r.ok)throw new Error('Verification key unavailable.');return r.json();});
    if(!await groth16.verify(key,result.publicSignals,result.proof))throw new Error('Generated proof failed local verification.');
    const calldata=await groth16.exportSolidityCallData(result.proof,result.publicSignals);
    self.postMessage({ok:true,calldata:JSON.parse('['+calldata+']')});
  }catch(e){self.postMessage({ok:false,error:e instanceof Error?e.message:'Proof generation failed.'});}
};
