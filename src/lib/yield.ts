import { Contract, type Provider } from 'ethers';
import { NETWORKS, TOKEN_ABI, type ChainNote } from './chain';
const WAD=10n**18n;
export function noteYield(note:ChainNote,rate:bigint) {
  if(!note.value||!note.depositRate)return null;
  const shares=BigInt(note.value), initial=shares*BigInt(note.depositRate)/WAD, current=shares*rate/WAD;
  return {initial,current,earned:current-initial};
}
// A historical RPC failure must never turn today's rate into a fabricated baseline.
export async function enrichDeposit(note:ChainNote,provider:Provider,blockNumber:number):Promise<ChainNote> {
  const base={...note,depositBlock:blockNumber};
  try {
    const token=new Contract(NETWORKS.testnet.token,TOKEN_ABI,provider);
    const [rate,block]=await Promise.all([token.stEthPerToken({blockTag:blockNumber}),provider.getBlock(blockNumber)]);
    if(!block||rate<=0n)return base;
    return {...base,depositRate:rate.toString(),depositTimestamp:block.timestamp};
  }catch{return base;}
}
