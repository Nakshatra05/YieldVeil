# Hoodi protocol v1

The immutable pool accepts ETH via Lido wstETH receive or transfers wstETH directly. It credits actual balance delta, enforces minimum received shares on ETH deposits, and has no owner withdrawal, upgrades or arbitrary execution.

## Note statement

- precommitment = Poseidon2(nullifier, secret)
- commitment = Poseidon2(value, precommitment)
- nullifierHash = Poseidon2(nullifier, 0)

Random nonzero secrets are generated in the browser. Duplicate precommitments are forbidden. Commitments enter a depth-16 tree, with 64 recent roots and leaf pagination of at most 256. Clients fetch the complete tree. Fixed wstETH shares have a variable stETH redemption value; there is no ETH redemption path.

## Withdrawal

Private witness: nullifier, secret, 16 siblings and boolean path indices. Public signals in Solidity order: authorization, root, nullifierHash, value, context, mode, exposedCommitment.

Context is keccak256(abi.encode(chainId, pool, recipient, relayer, fee, deadline)) modulo the BN254 scalar field. Authorization is Poseidon2(nullifier, context), binding context inside the circuit. The circuit constrains the same value/secrets to a tree leaf, value to 128 bits, and mode/path indices to booleans. Withdrawals consume the whole note, without change outputs.

The pool checks context, root, nullifier, amount, recipient, deadline and Groth16 proof. Effects precede transfers; all mutating functions are reentrancy-guarded. Nonzero fees require the named relayer to submit. Private UI exits use signed fee quotes from the hosted Hoodi relayer; public exits retain zero fees.

Mode 0 exposes no commitment. Mode 1 exposes the commitment and requires its original depositor as both sender and recipient, with zero fee. Both modes require a valid proof and consume the same nullifier. Public exit cannot bypass lost artifacts or unavailable proving.

## Trust and limits

Only chains 560048 and local 31337 are accepted. Caps: 0.1 ETH/wstETH deposit, 10 wstETH outstanding liabilities, 65,536 lifetime leaves. No pause or upgrade exists. The single-contributor setup, contract and circuit are unaudited and only for testnet.

Amounts, deposit accounts and timing are public. Unique amounts and gas funding can link exits. UI sender checks do not guarantee anonymity. No association-set provider, screening claim or cross-chain guarantee is included.

## Client integrity

The client compares deployed pool/verifier/hasher runtime bytecode to committed artifacts, masking only compiler-declared immutable slots. It separately checks token/verifier/hasher addresses. Deployment resumption is keyed to release bytecode and stores transaction hashes before confirmation.

AES-256-GCM notes use random salt (16 bytes), nonce (12 bytes) and PBKDF2-SHA256 with 310,000 iterations. Versioned encrypted state uses Web Locks where available and rejects stale cross-tab writes. Deposit receipts populate amounts/commitments; nullifier reads reconcile spent notes. A pre-deposit backup and confirmed receipt can recover metadata, but lost secrets cannot be recreated.

The browser worker creates and locally verifies proofs before wallet submission. Build checks artifact hashes. Hosting-origin integrity remains essential. Vercel uses a restrictive CSP, no telemetry and no remote scripts. Wallet RPC provides chain access and can observe public metadata.
