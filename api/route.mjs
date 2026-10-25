import {Contract,JsonRpcProvider,Wallet,keccak256} from 'ethers';
import {ABI,CHAIN,POOL,TOKEN,GAS_PRICE,scalar,validateRequest,validateProof} from '../server/relay-core.mjs';
import {ROUTES} from '../server/routes-config.mjs';
import {ROUTE_ABI,routeInstruction,signRoute,validRoute} from '../server/route-core.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed.'});
 const key=process.env.HOODI_RELAYER_KEY;
 if(!ROUTES||!key||process.env.HOODI_RELAYER_ENABLED!=='true')return res.status(503).json({error:'Atomic exit service unavailable. Full wstETH exits remain available.'});
 const provider=new JsonRpcProvider(process.env.HOODI_RPC_URL||'https://ethereum-hoodi-rpc.publicnode.com',undefined,{cacheTimeout:-1});
 try{
  if((await provider.getNetwork()).chainId!==BigInt(CHAIN))throw Error();
  const wallet=new Wallet(key,provider),pool=new Contract(POOL,[...ABI,'function leafCount() view returns(uint256)'],provider),factory=new Contract(ROUTES.factory,ROUTE_ABI,wallet);
  const reserve=new Contract(ROUTES.reserve,['function quote(uint256) view returns(uint256)'],provider);
  const [block,balance]=await Promise.all([provider.getBlock('latest'),provider.getBalance(wallet.address)]);
  if(!block||balance<3400000n*GAS_PRICE||(block.baseFeePerGas??0n)>=GAS_PRICE)return res.status(503).json({error:'Relay gas funding or network conditions require attention. Full self-submitted wstETH exits remain available.'});
  if(req.method==='GET')return res.status(200).json({available:true,...ROUTES,ethLiquidity:(await provider.getBalance(ROUTES.reserve)).toString(),usdcAvailable:false});
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!body||JSON.stringify(body).length>18000)throw Error();
  if(body.action==='quote'){
   validateRequest(body);const gross=scalar(body.gross),value=BigInt(body.value),changePre=scalar(body.changePrecommitment);
   if(gross<=0n||gross>value||![0,1].includes(body.output)||(gross===value)!==(changePre===0n))return res.status(400).json({error:'Invalid amount, change note or output asset.'});
   if(await pool.spent(body.nullifierHash))return res.status(409).json({error:'Note already spent. Refresh note status.'});
   if(gross<value&&await pool.leafCount()>=65536n)return res.status(409).json({error:'The tree is full. Withdraw this entire note.'});
   const [nonce,pending,rate]=await Promise.all([provider.getTransactionCount(wallet.address,'latest'),provider.getTransactionCount(wallet.address,'pending'),new Contract(TOKEN,['function stEthPerToken() view returns(uint256)'],provider).stEthPerToken()]);
   if(nonce!==pending)return res.status(409).json({error:'Another exit is confirming. Request a quote shortly.'});
   const gasLimit=gross<value?1700000n:750000n;
   const fee=(gasLimit*GAS_PRICE*120n*10n**18n+rate*100n-1n)/(rate*100n);
   if(fee>=gross)return res.status(400).json({error:'Withdrawal amount is smaller than the relay fee. Increase the amount or self-submit a full wstETH exit.'});
   const expected=body.output===0?gross-fee:await reserve.quote(gross-fee);
   if(body.output===1&&await provider.getBalance(ROUTES.reserve)<expected)return res.status(409).json({error:'Insufficient Hoodi ETH inventory. Choose wstETH or try after replenishment.'});
   const q={kind:'route-v1',chainId:CHAIN,pool:POOL,factory:ROUTES.factory,recipient:body.recipient,relayer:wallet.address,nullifierHash:body.nullifierHash,value:body.value,gross:gross.toString(),fee:fee.toString(),changePrecommitment:changePre.toString(),minimum:(body.output===0?expected:expected*995n/1000n).toString(),expectedOutput:expected.toString(),output:body.output,deadline:block.timestamp+900,nonce,gasPrice:GAS_PRICE.toString(),gasLimit:gasLimit.toString()};
   q.router=await factory.predict(q.nullifierHash,routeInstruction(q));
   return res.status(200).json({...q,signature:signRoute(q,key)});
  }
  const q=body.quote;
  if(body.action!=='submit'||!validRoute(q,key)||q.kind!=='route-v1'||q.factory!==ROUTES.factory||q.pool!==POOL||q.chainId!==CHAIN||q.relayer!==wallet.address||q.gasPrice!==GAS_PRICE.toString())return res.status(400).json({error:'Invalid route quote. Request a fresh quote.'});
  const route=routeInstruction(q);
  if((await factory.predict(q.nullifierHash,route)).toLowerCase()!==q.router.toLowerCase())throw Error();
  validateProof(body.calldata,{...q,recipient:q.router,relayer:q.router});
  const raw=await wallet.signTransaction({chainId:CHAIN,type:0,to:ROUTES.factory,data:factory.interface.encodeFunctionData('execute',[...body.calldata,route]),value:0,nonce:q.nonce,gasLimit:BigInt(q.gasLimit),gasPrice:GAS_PRICE});
  const hash=keccak256(raw);if(await provider.getTransaction(hash))return res.status(200).json({hash});
  if(q.deadline<block.timestamp+30||await provider.getTransactionCount(wallet.address,'latest')!==q.nonce)return res.status(409).json({error:'Quote expired or its nonce was used. Request a new quote.'});
  await factory.execute.staticCall(...body.calldata,route);
  if(await factory.execute.estimateGas(...body.calldata,route)>BigInt(q.gasLimit))throw Error();
  try{await provider.broadcastTransaction(raw);}catch{if(!await provider.getTransaction(hash))return res.status(409).json({error:'RPC submission uncertain. Retry this same request or reconcile note status.'});}
  return res.status(200).json({hash});
 }catch{return res.status(400).json({error:'Exit validation failed. Refresh note status and quote. Failed swaps leave the original note unspent.'});}
 finally{provider.destroy();}
}
