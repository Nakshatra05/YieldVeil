# Hoodi relayed withdrawals and recovery

The shared immutable pool and proving artifacts are unchanged. Mainnet remains disabled.

## User flow

Connect a Hoodi browser wallet, unlock notes, select Withdraw, and enter a fresh recipient. Get a quote, review its exact wstETH fee and net proceeds, then accept. The browser proves locally; `/api/relay` receives only the proof, public signals and signed quote. The recipient requires no ETH. A connected deposit wallet may be used to read RPC data; it does not submit or sign the private withdrawal. Public exits remain available and explicitly link ownership.

Quotes expire after 15 minutes and bind the chain, configured pool, recipient, nullifier hash, note amount, fee, relayer address, nonce, gas price and gas limit. HMAC authenticates the server quote; the ZK proof and contract bind the withdrawal context. The server rejects public-mode relay requests, verifies with an onchain static call, checks gas bounds and sends only the configured pool's withdraw call.

## Concurrency and retry policy

This small Hoodi service has one funded signer, no custody of user notes, and no database. Quotes share the next confirmed nonce. It issues no quote while that signer has a pending transaction. All transactions use the same fixed legacy gas price (1.2 gwei) and a 550,000 gas ceiling. Competing quotes cannot replace one another at this same price; the first accepted transaction wins. Other users request a fresh quote after confirmation. A submission retry signs exactly the same raw transaction and returns its existing hash when found. It never silently increments a nonce or raises a fee. Do not use the relay wallet for unrelated transactions.

The fee is the gas ceiling at the fixed price plus 20%, converted into wstETH at the current Lido rate, rounded up. It is a quoted service fee, not a refund-adjusted gas receipt. Small notes may be uneconomical or below the fee; the UI shows net proceeds before acceptance and retains public exits. If base fee reaches the fixed price, service pauses rather than submitting a stuck transaction. A stalled pending transaction requires operator attention. Before changing the gas price, stop new quotes, drain pending transactions and allow outstanding quotes to expire.

This is bounded-throughput testnet infrastructure. Mainnet needs a durable transaction queue, operational funding/rebalancing, abuse controls, independently reviewed privacy protections and a production proving setup.

## Deployment and operation

Vercel production secrets: `HOODI_RELAYER_KEY` (dedicated Hoodi signer, Secret/sensitive type) and `HOODI_RELAYER_ENABLED=true`. Optional `HOODI_RPC_URL` must resolve to chain 560048. Never use a `VITE_` prefix or commit private keys. Preview deployments receive no production key and return unavailable.

`GET /api/relay` checks chain, gas conditions and funding before returning the public relay address. A balance below two maximum gas budgets pauses service. Fees accrue in wstETH, while gas is paid in ETH; the operator must replenish Hoodi ETH. Disabling the environment flag and redeploying stops new submissions without locking user funds. Preserve the relay key while transactions are pending.

No application request-body logging is added. Vercel and the RPC provider may retain network/access metadata; the relayer sees the requesting IP and public withdrawal parameters. Amounts, timing and recipient addresses remain public. Relaying is not an anonymity guarantee or sanctions-screening claim.

## Historical staking value

Each confirmed note records its deposit block and the canonical token's `stEthPerToken()` at that block. Growth equals current underlying stETH value minus underlying stETH value at deposit, using integer arithmetic. Shares stay constant. Negative rate changes are preserved. Historical RPC failure leaves growth unknown and can be retried; current rates are never substituted for historical rates. Restoring/reconciling re-reads deposit receipts and historical rates. Values concern active notes only and exclude fees and market-price changes.

## Guided recovery

New deposits require selecting the downloaded encrypted backup and successfully decrypting it before wallet submission. Recovery separately decrypts an incoming file, previews note count, merges without overwriting existing secrets, checks receipts and spent nullifiers, and downloads a fresh encrypted backup. Different backup passphrases are supported after unlocking the existing vault; merged notes are encrypted with the existing vault passphrase. No existing vault is replaced on decryption or RPC failure. Pending notes without a saved transaction hash can be recovered using the confirmed deposit receipt. Keep the backup and passphrase separately; wallet keys cannot reconstruct ownership notes.
