# Yieldveil

**Privacy that pays.** A yield-bearing privacy-pool concept by **Naksh** ([@Naksh005](https://x.com/Naksh005)), built as an independent AQUA0 residency prototype.

Neobrutalist React + TypeScript application, with lavender panels, acid-green accents, bold borders, and responsive layouts.

> **Current release: browser-only interactive prototype.** No real deposits, staking, zero-knowledge proofs, relaying, sanctions screening, or cross-chain settlement occur. Do not send funds to this project. The app does not request transaction signatures and contains no deployed custody address. A Poseidon commitment is not a ZK proof and does not make browser-local activity private onchain.

## Run locally

Use Node.js 22.12+ or 24 and npm.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

`vercel.json` configures the Vite build, static output, and security headers. No environment variables or private keys are needed. The production bundle makes no API calls; optional wallet connection only requests the public account list.

## Try the demo

1. Create a demo vault using a passphrase of at least 12 characters.
2. Simulate an ETH or wstETH deposit. ETH is converted at the explicitly illustrative rate of 1.20 ETH per wstETH.
3. Switch to Withdraw. Choose a note and enter a fresh-shaped recipient address (e.g. `0x2222222222222222222222222222222222222222`). No transfer will occur.
4. Partial withdrawal consumes the old note and creates a new change note. The gross withdrawal includes the illustrative 0.0005 wstETH relayer fee.
5. Inspect encrypted local activity and note inventory. Explore public exit in Settings.
6. Export an encrypted backup. Reload, unlock, or restore the backup with its passphrase.

All demo deposits use `0x1111111111111111111111111111111111111111` as the original depositor, regardless of any display-only wallet connection. Withdrawing privately to that address is blocked. Public exit returns the full simulated note there.

## What is implemented

- ETH/wstETH deposit and partial/full withdrawal state machines.
- 18-decimal `bigint` accounting, downward share conversion, explicit fee accounting.
- Poseidon note commitments and nullifier hashes over the BN254 field; rejection-sampled random secrets.
- Fresh nullifier/secret pairs for change notes; stable deposit label.
- AES-256-GCM encrypted browser storage and JSON backups; PBKDF2-SHA256, 310,000 iterations, fresh 128-bit salts, 96-bit IVs.
- Schema/integrity validation on backup import; no plaintext persistence of notes or passphrase.
- Cross-tab stale-write protection using Web Locks and ciphertext comparison; inactivity locking after ten minutes.
- A Web Worker that checks note integrity. **It does not produce a proof.**
- Yield projection controls, local history, ragequit simulation, keyboard-accessible dialogs and responsive UI.
- AQUA0 adapter capability boundary that always reports unsupported; unavailable routes cannot execute.
- Proposed Solidity interfaces and a nonpayable, always-reverting adapter placeholder, clearly separate from the app.

## What remains before testnet

The supplied HLD describes a multi-phase protocol, not just a frontend. This release does **not** implement its custody pool, Entrypoint, Lido staking adapter, verifiers/circuits, Merkle indexer, ASP, or relayer. See [the implementation plan](docs/IMPLEMENTATION.md) and [protocol integration contract](docs/PROTOCOL.md).

No real APR or exchange-rate feed is connected. The graph is a simple non-compounded projection with a configurable illustrative APR (default 3%). For an empty vault it illustrates 1 ETH. No earned yield is fabricated. Actual stETH redemption value, ETH market value, and DEX proceeds can differ.

## Privacy and recovery boundaries

- Passphrase protection protects stored ciphertext, not an unlocked browser or malicious frontend code. XSS, extensions, compromised dependencies, and weak passphrases remain risks.
- Wallet connection is optional and for display only. It is not authentication and does not derive note keys.
- Wallet-signature recovery from the HLD is **not implemented**. Passphrase + encrypted backup are required to move this demo vault to another device; lost passphrases cannot be reset.
- The association set is simulated as approved. There is no actual screening or anonymity set.
- Reload locks the vault. Closing the page does not erase the encrypted copy. Browser storage clearing can remove it; export a backup.
- Restoring replaces local demo state. Historical backups can resurrect spent *demo* notes; a real client must reconcile them with onchain nullifiers. The browser is not a double-spend authority.
- Local nullifier checks prevent repeated spending within the current state, not adversarial state rollback.
- HTTP hosting still exposes request metadata to the host. No analytics SDK, remote font request, or app telemetry is included.

## Repository map

```text
src/App.tsx                       Vault, activity, settings, protocol explanation
src/styles.css                    Responsive neobrutalist design system
src/lib/protocol.ts                Exact accounting and local note state transitions
src/lib/vault.ts                   Encryption, decryption, backups
src/lib/aqua.ts                    Explicit unsupported-route boundary
src/lib/protocol.test.ts           Accounting, lifecycle, encryption, adapter tests
src/workers/witness.worker.ts      Local integrity check (not a ZK prover)
contracts/interfaces/             Proposed protocol and exit adapter ABI
contracts/AquaExitAdapterUnavailable.sol  Fail-closed integration placeholder
docs/                             Architecture, API design, testnet implementation plan
```

## Verification

`npm test` covers exact wei parsing, malformed input, share rounding, value conservation, change-note freshness, duplicate spending, full exits, rejected-note ragequit, recipient validation, backup integrity, wrong passphrases, ciphertext tampering, and unsupported routes. `npm run build` type-checks and produces the production bundle.

Browser QA also exercises vault creation, unlock, simulated deposit, recipient rejection, partial withdrawal, and route gating. These checks validate the demo, not a production cryptographic protocol.

## Technical references

- [Lido wstETH contract documentation](https://docs.lido.fi/contracts/wsteth/): fixed share accounting and staking/wrapping integration.
- [0xbow Privacy Pools core](https://github.com/0xbow-io/privacy-pools-core): potential circuit/protocol reference. No source has been copied or license assumed compatible; perform a version-specific license and audit review before reuse.
- [Aqua0 project documentation](https://github.com/jackmielke/Aqua0/blob/main/DOCUMENTATION_INDEX.md) and [Aqua0 shared-liquidity implementation](https://github.com/Aqua0-fi/Pitchday): research references with different integration assumptions; not evidence that Yieldveil routes or wstETH are supported.

The supplied `Yieldveil_HLD.pdf` informed the design. This repository follows the user's requested branding and credits Naksh; the PDF is not redistributed.
