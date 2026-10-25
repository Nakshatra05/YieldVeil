# Circle test USDC on Base Sepolia

Open `/app/usdc` for the independent Base Sepolia vault. Deposit Circle test USDC and withdraw a full note to a chosen address using the existing Groth16 ownership circuit. The recipient can receive USDC without holding ETH through the funded relayer. Alternatively, self-submit a proof and pay gas from a connected wallet. Self-submission can link the submitting wallet to the recipient.

## Network and custody

- Chain ID: 84532 (Base Sepolia).
- Circle USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, six decimals.
- Pool: `0xdbC0e6029727A3DdaA13c675B99F24353f01bAa4`.
- Verifier: `0xbB90BD31805171908171c3BAc161fc9021C74A1E`.
- Poseidon: `0x19e363375f3f69EFb3a2120a11B06e4B9E0F21b3`.
- Deployment block: 49902319.

The client checks the chain, all three runtime bytecodes and immutable pool dependencies before transactions. The pool constructor permits Base Sepolia and local test chain 31337 only, and pins the Circle token on Base Sepolia. It has no owner, upgrade path or investment adapter. ETH deposits are rejected. USDC deposits require exact-amount approval and exact token receipt. The per-note limit is 100 test USDC; total liabilities are capped at 10,000 test USDC.

Token reference: [Circle's official testnet contract registry](https://developers.circle.com/stablecoins/usdc-contract-addresses). Get [Circle test USDC](https://faucet.circle.com) and [Base Sepolia ETH](https://docs.base.org/get-started/get-funds). Testnet USDC has no financial value or dollar backing. Circle retains token-level pause and blocklist controls, which can prevent transfers even though the pool itself has no administrator.

## Yield and network separation

USDC is held as USDC: this vault does not generate yield. The separate Hoodi vault continues to earn the Lido staking-value changes reflected in wstETH's onchain stETH redemption rate. Returns vary and can be negative. The USDC screen links to that yield vault without implying a conversion or a shared balance. Adding a USDC lending strategy would require validating its contract, liquidity, redemption mechanics and loss accounting; a displayed APY is not a substitute.

This release does not bridge Hoodi notes, swap ETH for USDC, support partial USDC withdrawals or combine the anonymity sets of the two pools. Hoodi ETH/wstETH partial exits continue unchanged. The original Hoodi contracts, circuits, proving artifacts, backup format and browser-storage key are untouched.

## Backups and recovery

USDC backups use `yieldveil-base-usdc-v1` and storage key `yieldveil.base-sepolia.usdc.encrypted-notes.v1`. Hoodi files are rejected in the USDC vault and vice versa. AES-GCM and PBKDF2 protect backups; secrets are generated and proofs computed locally. A pending USDC note includes its expected amount and commitment, so recovery can find a confirmed deposit in the complete leaf tree even if the browser never saved the transaction hash. Users must reopen the downloaded backup before depositing. Restore merges with unlocked existing notes, preserves spent state, checks the chain and downloads a new encrypted backup. Keep backups and passphrases separately.

## Relay operation

`GET /api/usdc-relay` reports availability. `POST` accepts `quote` and `submit`. The flat fee is 0.01 test USDC, disclosed before proof generation; this is sponsored testnet gas, not an ETH/USD price conversion. Smaller notes remain withdrawable with self-submission. The backend accepts `TESTNET_RELAYER_KEY`, with the existing `HOODI_RELAYER_KEY` as a backwards-compatible fallback. The same dedicated testnet signer has independently funded balances and separate nonces on each chain. Never use the exposed deployment wallet as the hosted relay key.

Set `BASE_USDC_RELAYER_ENABLED=false` to disable this relay or `BASE_SEPOLIA_RPC_URL` to select another Base Sepolia RPC. HMAC quotes use a Base-USDC-specific domain and bind chain, pool, recipient, fee, nonce, gas price/limit and deadline. Every retry signs the same transaction; it does not increase gas price or take another nonce. Concurrent quotes may compete for one slot; the losing request must obtain a new quote. The proof binds chain/pool/recipient/relayer/fee/deadline; contracts reject replay. Base execution and L1 data fees are paid from funded test ETH. Low funds or unsuitable base fees pause quoting.

## Security and verification

Amounts, recipient, timing and network metadata remain observable. A small pool does not guarantee anonymity. The same unaudited testnet-only local trusted setup applies; this release is not a production security claim.

Unit tests cover backup compatibility/isolation, pending commitment integrity, merge safety, HMAC domain separation and proof context validation. Local EVM tests use actual Groth16 proofs for both the original Hoodi behavior and the USDC pool, including six-decimal conservation, deposit limits, unauthorized relay attempts, cross-pool rejection and replay. Public network evidence is recorded in `base-usdc-verification.json` after the live test.
