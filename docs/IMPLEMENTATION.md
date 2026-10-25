# Implementation status

The supplied HLD describes a broader system. This release implements a narrower, full-note Hoodi protocol with real transactions and proofs.

Implemented: landing and vault UI, EIP-1193 wallets, ETH/wstETH deposits, immutable custody, Poseidon tree, Circom/Groth16 proofs, private and public full-note exits, encrypted backups, receipt recovery, onchain state reconciliation and resumable deployment.

The shared Hoodi deployment is published in public/deployments.json. All three runtime bytecodes and their dependencies match the release artifacts; see HOODI_DEPLOYMENT.md for addresses and confirmed test transactions. Mainnet is closed. Atomic partial exits and funded Hoodi ETH swaps use the original pool and proof artifacts; see ATOMIC_EXITS.md. ASP and cross-chain liquidity are not implemented. A Hoodi relay service, deposit-block yield tracking, and guided recovery are implemented; see RELAYER.md.

Hoodi integration checks passed for canonical Lido ETH conversion, direct wstETH deposits, encrypted-backup/receipt recovery, private/public withdrawals, single-use nullifiers and empty-pool conservation. These are functionality checks, not an anonymity guarantee or audit. For explorer verification use Solidity 0.8.38, optimizer 200 runs, Shanghai EVM target and exact constructor arguments.

Before mainnet: independent contract/circuit/privacy review, multi-party setup, amount-correlation mitigation, relayer/indexer operations, association-set decisions, reorg/root-aging and concurrency testing, incident procedures and retention of every live pool's proving artifacts. A different network-ready contract is necessary; this one rejects mainnet.

Cross-chain integration must validate supported assets, routes, settlement and refunds with the actual provider. Liquidity infrastructure does not imply privacy. The current pool has no arbitrary adapter execution.

Verification: unit tests cover tree paths, context separation, encrypted backup tampering and bytecode matching. EVM tests deploy the actual verifier and pool, prove both exits, reject tampered signals/context and replay, and check token conservation. A test Lido adapter exists only in the local test process. CI recompiles artifacts and builds. Browser QA covers responsive layout, navigation, note controls and proof-worker execution.

Dependency status: Ganache's bundled development tree has known npm advisories. It is not imported into browser code or exposed as a public RPC server. This is not a clean dependency-audit claim. Update/replace the harness and review all dependencies before mainnet. GPL notices and source are supplied for snarkjs/circomlib.
