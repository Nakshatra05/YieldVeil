import {createHmac,timingSafeEqual} from 'node:crypto';
export const ROUTE_TUPLE='(address recipient,address relayer,uint256 gross,uint256 fee,uint256 changePrecommitment,uint256 minimum,uint256 deadline,uint8 output)';
export const ROUTE_ABI=[`function predict(uint256,${ROUTE_TUPLE}) view returns(address)`,`function execute(uint256[2],uint256[2][2],uint256[2],uint256[7],${ROUTE_TUPLE})`,'function implementation() view returns(address)','function pool() view returns(address)','function asset() view returns(address)','function reserve() view returns(address)'];
export function routeInstruction(q){return {recipient:q.recipient,relayer:q.relayer,gross:q.gross,fee:q.fee,changePrecommitment:q.changePrecommitment,minimum:q.minimum,deadline:q.deadline,output:q.output};}
const fields=['kind','chainId','pool','factory','router','recipient','relayer','nullifierHash','value','gross','fee','changePrecommitment','minimum','expectedOutput','output','deadline','nonce','gasPrice','gasLimit'];
export function signRoute(q,key){return createHmac('sha256',key).update('yieldveil-atomic-route-v1:'+JSON.stringify(fields.map(k=>q[k]))).digest('hex');}
export function validRoute(q,key){return !!q&&typeof q.signature==='string'&&/^[a-f0-9]{64}$/.test(q.signature)&&timingSafeEqual(Buffer.from(q.signature,'hex'),Buffer.from(signRoute(q,key),'hex'));}
