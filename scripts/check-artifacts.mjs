import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('public/zk/manifest.json','utf8'));
for(const [name,expected] of Object.entries(manifest.sources??{}))if(createHash('sha256').update(await readFile(name)).digest('hex')!==expected)throw new Error('Circuit/verifier source changed without regenerating artifacts: '+name);
for(const [name,expected] of Object.entries(manifest.artifacts)){const data=await readFile('public/zk/'+name);if(data.length!==expected.bytes||createHash('sha256').update(data).digest('hex')!==expected.sha256)throw new Error('Proving artifact mismatch: '+name);}
const a=JSON.parse(await readFile('public/contracts/artifacts.json','utf8'));
for(const name of ['pool','verifier','poseidon'])if(!a[name]?.bytecode?.startsWith('0x')||!a[name]?.runtime?.startsWith('0x'))throw new Error('Missing contract artifact: '+name);
console.log('Bundled proving artifacts match their SHA-256 manifest.');
