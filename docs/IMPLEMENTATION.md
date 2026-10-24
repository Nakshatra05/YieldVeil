# From residency demo to testnet

## Delivered milestone

The local application is complete as an interactive prototype: vault creation/locking, exact simulated deposits, encrypted note persistence, partial/full withdrawals, activity, public exits, backup restore and projection controls. It is suitable for explaining and demonstrating product behavior. It is not a production savings product.

React/Vite was chosen for this static milestone rather than the HLD's Next.js: there are no server-rendered or backend routes yet. The protocol modules are framework-independent. Storage uses encrypted localStorage for the small demo rather than IndexedDB; move to transactional IndexedDB before a chain-backed vault.

## Milestone 1 — contract and circuit foundation

1. Select a pinned circuit stack after reviewing 0xbow's license, published audits and deployed version. Decide whether reuse or new circuit work is appropriate.
2. Implement immutable wstETH custody, measured-delta deposits, fixed root-history policy, single-use nullifiers, liability tracking, deposit caps and a public escape hatch. Keep the fund-holding pool separate from any upgradeable router.
3. Implement and independently review withdrawal and ragequit constraints, including amount range checks and complete context binding.
4. Add Foundry unit, fuzz and invariant tests: token conservation, no repeated spends, invalid roots/proofs, stale roots, partial exits, reentrancy, fee/minimum-out boundaries, and exits during wind-down.
5. First deploy only to a local EVM using mocks, then a chosen testnet with explicit contract addresses. Never silently fall back to simulated settlement on transaction failure.

Acceptance: an automated local-EVM deposit → proof → partial withdrawal → public exit test, with actual circuit verification and conservation checks, passes. The current Solidity files are interface proposals, not this implementation.

## Milestone 2 — public-data services and client integration

1. Build the indexer, full-tree retrieval and reorg handling.
2. Implement an auditable ASP snapshot publisher; make its policy and trust assumptions explicit.
3. Build a relayer that accepts proofs/public outputs only, verifies them, simulates calls, and tracks confirmed receipts.
4. Integrate audited proving artifacts in a browser worker, EIP-1193 wallet actions, network checks and testnet-specific configuration.
5. Add encrypted IndexedDB persistence, pending transaction journals, onchain nullifier reconciliation, and tested change-note recovery.
6. Show chain-derived rates with provenance and stale-data handling. Keep staking redemption value separate from DEX output estimates.

Acceptance: a user on a fresh browser can restore notes, reconcile state, and spend on testnet without sharing a witness with backend services.

## Milestone 3 — AQUA0 proof of concept

Resolve with AQUA0: exact integration/deployment, supported assets and networks, quote APIs, liquidity guarantees, required approvals, execution model, settlement delay, timeout/refunds, and observable metadata. The available public research describes multiple architectures, so none should be assumed to be the residency integration.

Implement one allowlisted route with a mock first; prove value conservation and failure recovery. Then run a supported testnet route. Document exactly which portion, if any, is privacy-preserving. Keep unsupported routes disabled.

## Mainnet release gate

Contract and circuit audits, setup ceremony where required, provider and key-management policies, monitoring, capped deposits, incident response, bug bounty, and a tested wind-down path. Projected yield must never be advertised as guaranteed fee coverage or guaranteed anonymity.
