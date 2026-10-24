const { CircomRunner, bindings } = require('circom2');
const fs = require('node:fs');
// Keep WASI paths POSIX on Windows; circom2's CLI normalizes them to backslashes.
const runner = new CircomRunner({ args: process.argv.slice(2), env: process.env, preopens: { '.': '.' }, bindings: { ...bindings, fs, exit: code => process.exit(code) } });
runner.execute(fs.readFileSync(require.resolve('circom2/circom.wasm'))).catch(e => { console.error(e); process.exit(1); });
