# Protocol integration contract — proposed, not deployed

This document defines the boundary between the working local UI prototype and the protocol described in the HLD. The frontend currently calls only `src/lib/protocol.ts`; it never substitutes a local simulation for an onchain success receipt.

## Accounted asset

Use wstETH shares as the committed unit. A deposit credits the pool's measured balance delta after staking/wrapping, subject to a user-signed minimum share amount. Do not credit an oracle quote. Use integer arithmetic throughout; reject zero shares and field overflow.

Value display is `shares × stEthPerToken / 1e18`. That is a stETH redemption estimate, not guaranteed ETH exit proceeds. An ETH exit needs a separately quoted swap with proof-bound minimum output and expiry.

## Cryptographic boundary

HLD commitments:

```text
precommitment = Poseidon(nullifier, secret)
label         = Poseidon(scope, nonce)
commitment    = Poseidon(value, label, precommitment)
nullifierHash = Poseidon(nullifier)
```

The demo uses the same commitment/hash shape but random labels; it has no pool scope, deposit counter, chain-derived Merkle tree, or ASP tree. It does not produce compatible testnet witnesses.

The proposed withdrawal circuit must prove commitment inclusion, label inclusion in the approved set, ownership, a 128-bit amount constraint, conservation of shares, and a correctly formed change note. It must bind every executable output to a domain-separated context: chain ID, pool, recipient, relayer, fee, exit adapter, destination chain, minimum output, deadline, and route-data hash. Reject out-of-field values rather than accepting modular aliases.

Before paying out, contracts validate recognized state/association roots, freshness policy, context, verifier result and unused nullifier. Mark the nullifier before external calls; update liabilities and tree; then transfer payout and fee. Unknown roots, expired quotes, bad proofs, and unsupported adapters must revert atomically.

Changing a circuit changes the verification key. Do not publish generated proving artifacts from a single-party setup as production-ready. Verify dependency licenses and pinned audit scope; review circuits and Solidity independently.

## Proposed services

These endpoints are a design, not currently hosted services:

| Endpoint | Required behavior |
| --- | --- |
| `GET /v1/tree/leaves?from=<index>` | Public confirmed leaf pages, ordered and complete; include finalized block hash, tree version, total count and root. Never fetch a user-specific path. Client downloads all pages and reconstructs the root. |
| `GET /v1/roots/latest` | State root, association root, chain ID, pool, finalized block hash, root timestamps and policy. |
| `GET /v1/asp/set` | Full approved-label snapshot tied to its root and immutable content hash. No private membership query. |
| `GET /v1/stats` | Chain-derived TVL and counts with block/freshness metadata, never fabricated privacy guarantees. |
| `POST /v1/quote` | Public output parameters only; return a short-lived quote including chain, pool, gross amount, fee asset, fee, relayer, min output, destination and expiry. |
| `POST /v1/relay` | Accept public withdrawal inputs and ZK proof only. Verify offchain, simulate the exact call, submit and return a status ID. No note secrets, passphrase, witness or selected leaf index. |
| `GET /v1/relay/:id` | Pending/confirmed/reverted/reorged state, transaction hash and confirmed block. |

Rebuild the indexer on reorgs. Pin block hashes when generating a witness. Persist pending note transitions before relay submission and finalize them from verified chain receipts. Submission failure must leave the original note spendable unless the onchain nullifier is spent. A transaction hash alone is not settlement.

## Recovery and public exit

The real client must bind notes to chain ID, pool, circuit version, and derivation version. A robust deterministic recovery design also needs to recover partial-withdrawal change secrets, counters and derivation paths. Do not assume that every wallet will reproduce an identical EIP-712 signature. Decide whether explicit seed backup or a documented wallet-specific scheme is authoritative.

Ragequit proves ownership of a specific commitment, checks the original depositor for its label, spends its nullifier, and returns the full amount to the original address. It must not depend on ASP availability or approval. Its public link should be shown clearly.

## AQUA0 boundary

The repository's adapter always refuses execution. Before enabling a route, validate the exact deployment and SDK with the AQUA0 team, including wstETH support, approved source and destination chains, custody/approval needs, quote validity, fees, minimum received, and settlement finality.

Distinguish liquidity access from privacy. Public route parameters, amounts, timing and bridge messages may link exits. For asynchronous settlement, define escrow, timeout, refund address, and the point of irreversible nullifier consumption. Never mark a shielded withdrawal complete because a cross-chain message was merely submitted.

No arbitrary user-provided adapter, infinite token approval, live private key, or unchecked execution route belongs in the browser demo.
