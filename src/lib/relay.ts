export type RelayQuote={chainId:number;pool:string;recipient:string;relayer:string;nullifierHash:string;value:string;fee:string;deadline:number;nonce:number;gasPrice:string;gasLimit:string;signature:string};
export type RouteQuote=RelayQuote&{kind:'route-v1';factory:string;router:string;gross:string;changePrecommitment:string;minimum:string;expectedOutput:string;output:0|1};
export function isRoute(q:RelayQuote|null):q is RouteQuote{return !!q&&'kind' in q&&q.kind==='route-v1';}
export async function relayRequest<T>(body:unknown,routed=false):Promise<T>{
  const response=await fetch(routed?'/api/route':'/api/relay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error??'Relayer unavailable. Try again shortly.');
  return data;
}
