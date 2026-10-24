import { mkdir, readFile, writeFile, copyFile, rm, stat } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);
await mkdir('work/zk', { recursive: true }); await mkdir('public/zk', { recursive: true });
function node(script, args) { execFileSync(process.execPath, [script, ...args], { stdio: 'inherit', cwd: root }); }
if (!process.argv.includes('--skip-compile')) {
  const generated=path.resolve(root,'work/zk/withdraw_js');
  if(!generated.startsWith(path.resolve(root,'work/zk')+path.sep))throw new Error('Unsafe compiler output path');
  await rm(generated,{recursive:true,force:true});
  node('scripts/circom-portable.cjs', ['circuits/withdraw.circom', '--r1cs', '--wasm', '--sym', '-o', 'work/zk']);
}
const localSetup = process.argv.includes('--local-test-setup');
const cli = 'node_modules/snarkjs/build/cli.cjs';
const ptau = localSetup ? 'work/zk/local-test-final.ptau' : 'work/zk/powersOfTau28_hez_final_14.ptau';
if (localSetup) {
  try { if((await stat(ptau)).size===0)throw new Error('Incomplete setup'); } catch {
    node(cli, ['powersoftau', 'new', 'bn128', '14', 'work/zk/local-test-0.ptau']);
    node(cli, ['powersoftau', 'contribute', 'work/zk/local-test-0.ptau', 'work/zk/local-test-1.ptau', '--name=Local test only', '-e=' + randomBytes(64).toString('hex')]);
    node(cli, ['powersoftau', 'prepare', 'phase2', 'work/zk/local-test-1.ptau', ptau]);
  }
}
let bytes;
try { bytes = await readFile(ptau); } catch {
  const response = await fetch('https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau');
  if (!response.ok) throw new Error(`Powers of Tau download: ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer()); await writeFile(ptau, bytes);
}
const expected = 'eeefbcf7c3803b523c94112023c7ff89558f9b8e0cf5d6cdcba3ade60f168af4a181c9c21774b94fbae6c90411995f7d854d02ebd93fb66043dbb06f17a831c1';
if (!localSetup && createHash('blake2b512').update(bytes).digest('hex') !== expected) throw new Error('Published Powers of Tau checksum mismatch');
node(cli, ['groth16', 'setup', 'work/zk/withdraw.r1cs', ptau, 'work/zk/initial.zkey']);
// Development-only phase 2. Single contributor; NOT a production ceremony.
node(cli, ['zkey', 'contribute', 'work/zk/initial.zkey', 'public/zk/withdraw.zkey', '--name=Yieldveil testnet development', '-e=' + randomBytes(64).toString('hex')]);
node(cli, ['zkey', 'verify', 'work/zk/withdraw.r1cs', ptau, 'public/zk/withdraw.zkey']);
node(cli, ['zkey', 'export', 'verificationkey', 'public/zk/withdraw.zkey', 'public/zk/verification_key.json']);
node(cli, ['zkey', 'export', 'solidityverifier', 'public/zk/withdraw.zkey', 'contracts/WithdrawalVerifier.sol']);
await writeFile('contracts/WithdrawalVerifier.sol',(await readFile('contracts/WithdrawalVerifier.sol','utf8')).replace(/[ \t]+$/gm,'').trimEnd()+'\n');
await copyFile('work/zk/withdraw_js/withdraw.wasm', 'public/zk/withdraw.wasm');
const artifacts = {};
for (const name of ['withdraw.wasm', 'withdraw.zkey', 'verification_key.json']) { const b = await readFile(path.join('public/zk', name)); artifacts[name] = { sha256: createHash('sha256').update(b).digest('hex'), bytes: b.length }; }
const sources={};for(const name of ['circuits/withdraw.circom','contracts/WithdrawalVerifier.sol'])sources[name]=createHash('sha256').update(await readFile(name)).digest('hex');
await writeFile('public/zk/manifest.json', JSON.stringify({ circuit: 'Yieldveil full-note withdrawal v1', depth: 16, setup: 'Local phase 1 and single-contributor phase 2 — TESTNET ONLY', artifacts, sources }, null, 2));
console.log('Verified testnet proving artifacts and generated Solidity verifier.');
