export type RelayQuote={chainId:number;pool:string;recipient:string;relayer:string;nullifierHash:string;value:string;fee:string;deadline:number;nonce:number;gasPrice:string;gasLimit:string;signature:string};
export async function relayRequest<T>(body:unknown):Promise<T>{
  const response=await fetch('/api/relay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error??'Relayer unavailable. Try again shortly.');
  return data;
}
