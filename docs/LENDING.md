# Circle USDC lending on Base Sepolia

The opt-in [lending vault](https://yieldveil.vercel.app/app/usdc/yield) supplies Circle test USDC to Compound III. It is a separate immutable contract. The existing Base USDC and Hoodi pools, notes, storage keys, backup formats, proving artifacts and withdrawal paths are unchanged. There is no automatic migration, bridging, leverage or mainnet support. To move funds between pools, explicitly withdraw and deposit again with a new backup; timing and amounts can link those actions.

## Deployment

- Network: Base Sepolia, chain 84532
- Circle USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Compound III Comet: `0x571621Ce60Cebb0c1D442B5afb38B1663C6Bf017`
- Yieldveil lending pool: `0x43Fd67731Ae42b39B989136dB3257e73a1020ECA`
- Verifier: `0xbB90BD31805171908171c3BAc161fc9021C74A1E`
- Poseidon: `0x19e363375f3f69EFb3a2120a11B06e4B9E0F21b3`
- Deployment block: 49925776
- [Deployment transaction](https://sepolia.basescan.org/tx/0x3bc7ca2ca22254b28f318949b49503945dc8a67bcb829b22fa228dfbf9c1d17a)

Sources: [Compound deployments and protocol documentation](https://docs.compound.xyz/), [Comet accounting source](https://github.com/compound-finance/comet/blob/main/contracts/CometCore.sol), [Circle testnet USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses). Runtime checks verify the pool, verifier and Poseidon code, token decimals and Comet underlying asset. Aave's Base Sepolia market uses a different test USDC token; this integration uses the existing Circle token directly.

## How earned value is calculated

Deposits supply the actual six-decimal USDC to Comet. The pool records only the increase in its own positive Comet principal caused by that deposit. Direct USDC donations and externally supplied/transferred Comet principal are excluded from accounting, so they cannot masquerade as lending yield. There is no owner withdrawal function or borrowing permission.

The current supply index determines the value of the recorded principal. `previewRedeem` calls Comet's own `accrueAccount` inside an `eth_call`, accruing borrower interest through the queried block, then quotes the note's proportional USDC redemption value. This is current protocol accrual, not extrapolated future yield. Executing a withdrawal accrues and settles onchain again. Quotes can change between blocks.

The UI displays **net lending growth = current redeemable USDC - original USDC deposited**, across active notes only. Original principal is reconciled from the pool's immutable deposit record, not trusted from edited backup metadata. Missing or unverified values display a dash. Six-decimal precision and negative values are preserved; no APY, price feed, timer, expected interest or sponsored reward is added. The balance is before any relay fee. Spent notes are excluded; this is not a lifetime earnings report.

Comet rounds conversions between principal and USDC. The pool reserves one micro-USDC and uses one virtual micro-USDC plus one million virtual shares to prevent share inflation. Initial shares have approximately 12 decimal places, but only asset amounts are shown to users. Deposits credit their actual accounted increase. Dust and rounding may make a small position show zero or negative growth even when the supply rate is positive. A 0.1 USDC integration deposit initially redeemed for 0.099998 USDC, showing -0.000002 USDC, rather than a fabricated positive return. Test assets have no financial value.

## Withdrawals and recovery

A full-note Groth16 withdrawal binds chain, pool, recipient, relay fee, deadline and **minimum net USDC received**. Relay quotes set the minimum 0.5% below the currently quoted net payout, shown before acceptance. Self-submission uses the same 0.5% minimum with zero relay fee; the connected wallet pays ETH gas. A paused market, insufficient cash, or payout below the minimum reverts atomically and leaves the note unspent. A new quote/proof may be needed after expiry or a consumed relay nonce. A relayer does not bypass Compound withdrawal restrictions.

The flat relay fee is 0.01 Circle test USDC. Testnet gas is sponsored. The new endpoint `/api/lending-relay` shares the dedicated existing testnet signer, uses domain-separated HMAC quotes and fixed replacement gas pricing, and never accepts note secrets. The existing relayer credential works without introducing a new deployed secret. Operators can set `BASE_LENDING_RELAYER_ENABLED=false` independently. Liquidity/pause checks happen before quoting and the exact withdrawal is simulated before broadcast.

Before depositing, users must download and reopen an encrypted backup. Actual minted shares are recovered through `depositInfo(precommitment)`, so even a pre-deposit backup without a receipt/hash can restore the position. Lending backups use `yieldveil-compound-usdc-v1` and a separate local storage key. They cannot be imported as original USDC or Hoodi notes. Restores merge and reconcile spent status instead of overwriting existing notes.

## Limits and risks

Maximum 100 USDC per deposit, 10,000 USDC accounted pool assets and 65,536 lifetime commitments. Testnet constructors accept only Base Sepolia (and local chain 31337 for tests), and pin the Circle token and Comet market on Base Sepolia. The pool has no upgrade hook or strategy switch. Comet itself remains governed and upgradeable; market parameters, pauses and interest rates can change. Borrower/default/protocol risk, unavailable liquidity, Circle pause/blocklist controls, and browser/RPC/relayer metadata risks remain. No guaranteed return or guaranteed anonymity is claimed. All contracts and the testnet trusted setup remain unaudited.

## Verification

`npm test` checks isolated recovery, principal reconciliation, missing/zero/negative/positive growth and relay authorization. `npm run test:lending` deploys the actual pool and verifier on a local EVM, uses real Groth16 proofs, and tests supply accounting, donation exclusion, rounding, positive index accrual, losses, paused/illiquid rollback, proof-bound minima, replay rejection and self-submitted exits. Its mock market is used only for deterministic failure cases. The deployed vault uses the real Compound III market. Public integration receipts are in `lending-verification.json`.
