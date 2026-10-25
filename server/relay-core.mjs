import {createHmac,timingSafeEqual} from 'node:crypto';
import {AbiCoder,keccak256,isAddress,ZeroAddress} from 'ethers';
export const CHAIN=560048;
export const POOL='0x92369A8527557955e6A81e98c090D2d3dB043758';
export const TOKEN='0x7E99eE3C66636DE415D2d7C880938F2f40f94De4';
export const FIELD=21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const ABI=['function spent(uint256) view returns(bool)','function withdraw(uint256[2],uint256[2][2],uint256[2],uint256[7],(address recipient,address relayer,uint256 fee,uint256 deadline))'];
export const GAS_LIMIT=550000n;
export const GAS_PRICE=1200000000n; // Fixed 1.2 gwei: identical replacement price for every nonce reservation.
const fields=['chainId','pool','recipient','relayer','nullifierHash','value','fee','deadline','nonce','gasPrice','gasLimit'];
function canonical(q){return JSON.stringify(fields.map(k=>q[k]));}
export function signQuote(q,key){return createHmac('sha256',key).update(canonical(q)).digest('hex');}
export function validQuote(q,key){if(!q||typeof q.signature!=='string'||!/^[a-f0-9]{64}$/.test(q.signature))return false;return timingSafeEqual(Buffer.from(q.signature,'hex'),Buffer.from(signQuote(q,key),'hex'));}
export function scalar(value){if(typeof value!=='string'||!/^\d{1,78}$/.test(value)||BigInt(value)>=FIELD)throw new Error('Invalid field value.');return BigInt(value);}
export function validateRequest(data){
  if(!data||!isAddress(data.recipient)||data.recipient===ZeroAddress)throw new Error('Invalid recipient.');
  if(scalar(data.nullifierHash)===0n||scalar(data.value)===0n||BigInt(data.value)>10n**17n)throw new Error('Invalid note amount.');
}
export function context(q){return BigInt(keccak256(AbiCoder.defaultAbiCoder().encode(['uint256','address','address','address','uint256','uint256'],[CHAIN,POOL,q.recipient,q.relayer,q.fee,q.deadline])))%FIELD;}
export function validateProof(calldata,q){
  if(!Array.isArray(calldata)||calldata.length!==4)throw new Error('Invalid proof.');
  const [a,b,c,s]=calldata;
  const pair=v=>Array.isArray(v)&&v.length===2;
  if(!pair(a)||!pair(b)||!b.every(pair)||!pair(c)||!Array.isArray(s)||s.length!==7)throw new Error('Invalid proof shape.');
  for(const v of [...a,...b.flat(),...c,...s])if(typeof v!=='string'||!(/^(0x[\da-fA-F]{1,64}|\d{1,78})$/).test(v)||BigInt(v)>=2n**256n)throw new Error('Invalid proof value.');
  if(BigInt(s[2])!==BigInt(q.nullifierHash)||BigInt(s[3])!==BigInt(q.value)||BigInt(s[4])!==context(q)||BigInt(s[5])!==0n||BigInt(s[6])!==0n)throw new Error('Proof does not match this private withdrawal quote.');
}
