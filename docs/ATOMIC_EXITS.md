# Partial withdrawals and Hoodi ETH exits

Existing pools, notes, commitments, nullifiers, circuits, verifiers and proving keys are unchanged. Full wstETH withdrawals remain available through the original pool, with or without a relayer. No migration or redeposit is required before using partial exits.

## Atomic route

An immutable factory creates an ERC-1167 minimal proxy with CREATE2. Its salt commits to the input nullifier hash and every route field: recipient, relayer, gross share amount, fee, change precommitment, minimum output, deadline and output asset. The proxy points to a verified immutable implementation. The existing ZK proof binds its recipient and relayer to this predicted proxy address, which binds the complete route without changing the circuit.

The proxy withdraws the entire input note, redeposits the remainder under a fresh client-generated secret, pays the quoted relayer fee, and sends the net withdrawal to the recipient. ETH output uses a funded Hoodi ETH inventory contract. All steps occur in one transaction. Invalid proofs, changed instructions, insufficient inventory, failed ETH delivery or inadequate output revert everything, including nullifier consumption and change creation. These contracts share the unaudited/testnet security limits of the existing deployment.

The share amount entered by the user includes the relay fee. Remaining shares = original shares − entered amount. Output shares = entered amount − relay fee. ETH inventory quotes the Lido onchain stETH-per-wstETH conversion less a 0.3% spread; the proof-bound minimum allows a further 0.5% tolerance. This is not mainnet ETH pricing or asynchronous Lido unstaking. Inventory is finite and quotes are rejected when insufficient. Anyone can replenish the reserve with Hoodi ETH. Its operator can collect exchanged wstETH; it cannot withdraw user notes or change the exchange logic.

## Backups and recovery

The browser generates the new change secret and saves an encrypted backup before proving. The user must reopen that downloaded file successfully before submitting a partial withdrawal. After confirmation, a fresh backup contains the confirmed change note. If the browser closes before receiving the transaction hash, recovery can locate the backed-up change commitment in the complete onchain leaf tree. Receipt recovery also accepts deposit events emitted by the pool during a routed transaction. Event addresses are checked against the configured pool.

Change notes preserve the original deposit-block yield basis. If that historical basis is unknown, growth remains unknown rather than resetting to the change transaction date. A change note's onchain depositor is its one-use router, so the old ownership-linked public-exit mode is unavailable for that note. Its owner can always generate a private-mode proof and self-submit a full wstETH exit from an ordinary funded wallet; no relayer or reserve is required. The UI exposes that fallback explicitly.

## Privacy scope

The input note is spent using the existing ZK membership proof. Input/withdrawal amounts, route fields and the change deposit are public. This implementation does **not** hide the connection between a routed withdrawal and its change commitment, and does not solve amount correlation or guarantee anonymity. Confidential change amounts would require a new circuit/pool design. Existing encrypted backups remain compatible.

## Assets and deployments

- Factory: `0x19e363375f3f69EFb3a2120a11B06e4B9E0F21b3`
- Implementation: `0xF92f1bA89CA538EAD172a4f70FA9784eC37943F6`
- Funded ETH reserve: `0xD73d848287841875BaBDC7f7715d4908bF90c16c`
- Initial inventory: 0.1 Hoodi ETH.
- Public configuration: `public/routes.json`; compiled artifacts: `public/contracts/routes.json`.

Circle does not list USDC on Ethereum Hoodi in its [official address registry](https://developers.circle.com/stablecoins/usdc-contract-addresses). Morph Hoodi is a separate network. The UI therefore leaves USDC unavailable rather than presenting a custom token as Circle USDC. A custom test-token option requires an explicit product decision and clear labeling.

`GET /api/route` reports route addresses and current ETH inventory. Quotes and submissions use `POST /api/route`; `/api/relay` preserves original full-note withdrawals. Both share a signer, fixed gas price and nonce reservation policy, so concurrent requests cannot silently replace each other. Routed fees use a 1,700,000 gas budget for change creation or 750,000 for full ETH exits. The exact fee and minimum output are displayed before acceptance. Quotes may become unusable if another transaction takes the nonce; regenerate after confirmation.

## Verification

`npm run contracts:build` independently rebuilds legacy and route artifacts. CI compares both to committed outputs. The EVM test generates actual Groth16 proofs and tests partial ETH payout, CREATE2 recipient/change/asset binding, slippage rollback, replay rejection, share conservation and subsequent permissionless withdrawal of the change note. Browser and Hoodi integration receipts are recorded separately after deployment verification.
