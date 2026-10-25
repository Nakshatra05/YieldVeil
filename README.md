# Yieldveil

**Stay private. Keep growing.** Built by **Naksh** ([@Naksh005](https://x.com/Naksh005)).

[Website](https://yieldveil.vercel.app) · [Vault](https://yieldveil.vercel.app/app?network=testnet) · [Deploy](https://yieldveil.vercel.app/app?network=testnet#deployment)

[USDC vault](https://yieldveil.vercel.app/app/usdc): a separate Base Sepolia pool for Circle test USDC, with browser proofs, a funded relayer, self-submitted withdrawals and isolated recovery backups. It holds USDC without yield; staking yield remains in the Hoodi wstETH vault. There is no bridge or ETH-to-USDC conversion between pools. See [USDC deployment and operation](docs/USDC.md).

A neobrutalist landing page and wallet-connected privacy vault with immutable wstETH custody, Circom membership/ownership proofs, a generated Groth16 Solidity verifier, and browser proving. Deposits require wallet transactions; private withdrawals use a funded Hoodi relayer and confirmed receipts. No simulated balances or transaction-success fallback.

## Release status

**The shared Hoodi testnet pool is deployed.** Connect a Hoodi wallet in the vault to use the configured pool. You do not need to deploy your own contracts. ETH and wstETH deposits, both full-note withdrawal modes, encrypted note restoration and replay rejection have been tested against the deployed contracts. See [deployment addresses and test receipts](docs/HOODI_DEPLOYMENT.md). Mainnet is closed and the pool constructor rejects chain 1.

Contracts and circuits are unaudited. The bundled proving key uses a local single-contributor trusted setup for testnet testing only. Do not use assets with financial value. Production requires independent review and a public multi-party ceremony.

## Features

- ETH staking/wrapping through canonical Lido Hoodi wstETH; deposits credit the actual token balance delta.
- Direct wstETH deposits with exact-amount approval.
- Depth-16 Poseidon tree, actual browser Groth16 proving, Solidity verification and single-use nullifiers.
- Full-note withdrawals in wstETH, bound to chain, pool, recipient, fee and deadline.
- Explicit public exit to the original depositor using the same ownership proof/nullifier.
- AES-256-GCM encrypted notes, PBKDF2 passphrases, backup restoration, receipt recovery and spent-status reconciliation.
- Resumable wallet-driven deployment with runtime-bytecode validation.
- Hoodi/mainnet views, real wallet balances and onchain stETH-per-wstETH rate. Missing data stays unavailable.

Hoodi relayed withdrawals quote a wstETH fee before local proof generation. The recipient needs no gas. Actual staking growth uses historical deposit-block rates. Guided recovery merges encrypted backups, reconciles receipts/nullifiers, and downloads a fresh backup. Deposits require successfully reopening the downloaded backup.

Partial withdrawals and funded Hoodi ETH swaps are available through immutable atomic routes; see [atomic exits](docs/ATOMIC_EXITS.md). Existing notes and proving artifacts remain valid. There is no Circle USDC on Ethereum Hoodi, association-set provider, cross-chain exit or guaranteed anonymity. Amounts, timing, small pools, RPC queries and relayer request metadata can link activity. See docs/RELAYER.md for operating limits.

## Run and verify

Node.js 24 and npm:

```sh
npm ci
npm test
npm run contracts:build
npm run test:protocol
npm run build
npm run dev
```

The protocol test deploys the real pool, Poseidon and verifier on an in-memory EVM. Only Lido is replaced with a test token adapter. It generates real proofs and checks conversion, membership, exits, tampered context/signals, replay rejection, caps, ownership, bytecode and conservation. No private key or RPC is needed. Ganache may print a harmless optional native-module fallback warning on newer Node versions.

CI recompiles and compares artifacts, runs unit and EVM/proof tests, then builds. Build verifies proving artifact SHA-256 checksums.

## Deploy another Hoodi pool (developers)

The shared public pool is already active. These instructions are only for a separate deployment; preserve the current pool and its proving artifacts for existing notes.

1. Use an Ethereum browser wallet funded with **Hoodi test ETH** for deployment gas. No mainnet ETH is needed. Never share a seed phrase or private key.
2. Open the deployment console, connect, and switch to Hoodi (chain ID 560048).
3. Choose **Deploy testnet contracts** and review/sign Poseidon, verifier and pool deployments. Retry after an interruption to resume from saved transaction hashes.
4. Save `yieldveil-deployments.json`. It contains public addresses only. Replace `public/deployments.json` with its contents, commit and push to activate the pool for everyone.
5. Verify the addresses on Hoodi Etherscan and complete a small deposit, backup restore and withdrawal on Hoodi before inviting users. Local EVM tests do not replace this network check.

Canonical asset: `0x7E99eE3C66636DE415D2d7C880938F2f40f94De4`; verify with [Lido deployments](https://docs.lido.fi/deployed-contracts/hoodi/). Caps: 0.1 ETH/wstETH per deposit, 10 wstETH outstanding liabilities, 65,536 lifetime commitments.

## Notes and recovery

Keep the encrypted backup **before** confirming a deposit and the updated backup afterward. Keep its passphrase separately. Wallet keys cannot recreate note secrets. Restore through Notes and refresh onchain status. A pre-deposit backup can recover its amount/index from a confirmed deposit receipt. Replacement transactions may require manually entering the confirmed hash. Imports merge missing note IDs under the existing vault passphrase and preserve existing notes.

Clearing browser storage without a backup and passphrase loses access. Origin scripts and browser extensions remain part of the client trust boundary. No application server receives note secrets; wallet RPC can observe public metadata and queries.

## Circuit rebuild

```sh
npm run zk:build
npm run contracts:build
npm run test:protocol
```

The test-only setup takes time and changes the proving key/verifier. **Old pools are incompatible with a new key. Preserve old proving artifacts for old notes.** This is not a production ceremony workflow.

## Source and licenses

`src/Landing.tsx`: landing · `src/VaultApp.tsx`: app · `src/lib/chain.ts`: chain/tree · `src/lib/notes.ts`: encryption · `src/lib/deployment.ts`: bytecode checks · `src/workers/prover.worker.ts`: proving · `circuits/withdraw.circom`: circuit · `contracts/`: custody/verifier · `public/zk/`: proving artifacts.

[Protocol](docs/PROTOCOL.md) · [Implementation status](docs/IMPLEMENTATION.md) · [Third-party notices](THIRD_PARTY_NOTICES.md). The app includes GPL-3.0 snarkjs and is distributed with corresponding source/build scripts under GPL-3.0. Separately marked Solidity files retain their SPDX licenses.
