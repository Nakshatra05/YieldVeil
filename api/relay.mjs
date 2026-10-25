import {Contract,JsonRpcProvider,Wallet,keccak256} from 'ethers';
import {ABI,CHAIN,POOL,TOKEN,GAS_LIMIT,GAS_PRICE,signQuote,validQuote,validateRequest,validateProof} from '../server/relay-core.mjs';

// No note secrets, request bodies, IP addresses, or signing credentials are logged.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
  const secret=process.env.HOODI_RELAYER_KEY;
  if(process.env.HOODI_RELAYER_ENABLED!=='true'||!secret)return res.status(503).json({error:'The Hoodi relayer is offline. Public exits remain available.'});
  const provider=new JsonRpcProvider(process.env.HOODI_RPC_URL||'https://ethereum-hoodi-rpc.publicnode.com',undefined,{cacheTimeout:-1});
  try{
    if((await provider.getNetwork()).chainId!==BigInt(CHAIN))throw new Error('Wrong network.');
    const wallet=new Wallet(secret,provider),pool=new Contract(POOL,ABI,wallet);
    const [block,balance]=await Promise.all([provider.getBlock('latest'),provider.getBalance(wallet.address)]);
    if(!block||balance<GAS_LIMIT*GAS_PRICE*2n||(block.baseFeePerGas??0n)>=GAS_PRICE)return res.status(503).json({error:'Relayer gas funding or network fee conditions require attention. Try later or use a public exit.'});
    if(req.method==='GET')return res.status(200).json({available:true,chainId:CHAIN,pool:POOL,relayer:wallet.address});
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||JSON.stringify(body).length>16000)return res.status(400).json({error:'Invalid request size.'});
    if(body.action==='quote'){
      validateRequest(body);
      if(await pool.spent(body.nullifierHash))return res.status(409).json({error:'This note is already spent. Refresh note status.'});
      const [latest,pending,rate]=await Promise.all([provider.getTransactionCount(wallet.address,'latest'),provider.getTransactionCount(wallet.address,'pending'),new Contract(TOKEN,['function stEthPerToken() view returns(uint256)'],provider).stEthPerToken()]);
      if(latest!==pending)return res.status(409).json({error:'The relayer is confirming another withdrawal. Request a new quote shortly.'});
      const fee=(GAS_LIMIT*GAS_PRICE*120n*10n**18n+rate*100n-1n)/(rate*100n);
      if(fee>=BigInt(body.value))return res.status(400).json({error:'This note is smaller than the relay fee. Use a public exit.'});
      const q={chainId:CHAIN,pool:POOL,recipient:body.recipient,relayer:wallet.address,nullifierHash:body.nullifierHash,value:body.value,fee:fee.toString(),deadline:block.timestamp+900,nonce:latest,gasPrice:GAS_PRICE.toString(),gasLimit:GAS_LIMIT.toString()};
      return res.status(200).json({...q,signature:signQuote(q,secret)});
    }
    if(body.action!=='submit')return res.status(400).json({error:'Unknown relay action.'});
    const q=body.quote;
    if(!validQuote(q,secret)||q.chainId!==CHAIN||q.pool!==POOL||q.relayer!==wallet.address||q.gasPrice!==GAS_PRICE.toString()||q.gasLimit!==GAS_LIMIT.toString())return res.status(400).json({error:'Invalid relay quote. Request a new quote.'});
    validateProof(body.calldata,q);
    const exit=[q.recipient,q.relayer,q.fee,q.deadline];
    const data=pool.interface.encodeFunctionData('withdraw',[...body.calldata,exit]);
    const raw=await wallet.signTransaction({chainId:CHAIN,type:0,to:POOL,data,value:0,nonce:q.nonce,gasLimit:GAS_LIMIT,gasPrice:GAS_PRICE});
    const hash=keccak256(raw);
    // Same signed transaction on retry. Never advance the nonce or increase its price.
    const previous=await provider.getTransaction(hash);
    if(previous)return res.status(200).json({hash});
    if(q.deadline<block.timestamp+30)return res.status(409).json({error:'Quote expired. Request a new quote.'});
    if(await provider.getTransactionCount(wallet.address,'latest')!==q.nonce)return res.status(409).json({error:'Another withdrawal used this quote slot. Request a new quote.'});
    await pool.withdraw.staticCall(...body.calldata,exit);
    if(await pool.withdraw.estimateGas(...body.calldata,exit)>GAS_LIMIT)throw new Error('Gas limit exceeded.');
    try{await provider.broadcastTransaction(raw);}catch{
      if(!await provider.getTransaction(hash))return res.status(409).json({error:'Submission was not confirmed by the RPC. Retry this same request; if the slot was used, request a new quote.'});
    }
    return res.status(200).json({hash});
  }catch{
    return res.status(400).json({error:'Relay request could not be validated. Check note status and request a fresh quote. No note secrets are needed.'});
  }finally{provider.destroy();}
}
