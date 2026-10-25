# Active Hoodi deployment

Chain ID: 560048. Pool deployment block: 3882096. All three runtime bytecodes were compared to the committed artifacts, and pool dependency addresses were checked. This is bytecode verification, not a security audit or an explorer source-verification claim.

## Contracts

- pool: [0x92369A8527557955e6A81e98c090D2d3dB043758](https://hoodi.etherscan.io/address/0x92369A8527557955e6A81e98c090D2d3dB043758)
- verifier: [0x37068dB6bf8628ECBD685608d616E2026291B63c](https://hoodi.etherscan.io/address/0x37068dB6bf8628ECBD685608d616E2026291B63c)
- poseidon: [0x38922F3aA335a392f66ab01292db369564C007Fa](https://hoodi.etherscan.io/address/0x38922F3aA335a392f66ab01292db369564C007Fa)

## Confirmed integration checks

ETH staking/wrapping, direct wstETH deposits, public and private full-note withdrawals, encrypted-note restoration and receipt recovery, and replay rejection passed on Hoodi. Final pool liabilities and token balance are both zero. Test shares and unused submission-wallet ETH were returned to the originating wallet.

These tests used publicly linked wallets. They demonstrate functionality, not anonymity. Mainnet is disabled, the contracts are unaudited, and the trusted setup is for testing only.

## Transaction receipts

- poseidon: [0x53eb1875f16e07402cc0c586d5f082edbbb02cf040d0fe4e8b7ce02e5ed51b27](https://hoodi.etherscan.io/tx/0x53eb1875f16e07402cc0c586d5f082edbbb02cf040d0fe4e8b7ce02e5ed51b27) — block 3882069
- verifier: [0x375ff4f036510baf360cb435ebb0104679d12cdef9ca2182f735266360720e68](https://hoodi.etherscan.io/tx/0x375ff4f036510baf360cb435ebb0104679d12cdef9ca2182f735266360720e68) — block 3882094
- pool: [0x565230a89bed11ed3473cc6da471b7396737085d070397d28d92f3545e749291](https://hoodi.etherscan.io/tx/0x565230a89bed11ed3473cc6da471b7396737085d070397d28d92f3545e749291) — block 3882096
- ethDeposit: [0x07b298e3b4ad82e8a051955256debaa479953108b6b106cbc459891de2a83a7b](https://hoodi.etherscan.io/tx/0x07b298e3b4ad82e8a051955256debaa479953108b6b106cbc459891de2a83a7b) — block 3882099
- publicWithdrawal: [0x2371e576e18dfed87168f49a18d4a4c8c62ea4ce5cecb78520b4831597a2a72b](https://hoodi.etherscan.io/tx/0x2371e576e18dfed87168f49a18d4a4c8c62ea4ce5cecb78520b4831597a2a72b) — block 3882100
- testSubmitterFunding: [0xe34d1abc307eee6de446d48c8fbc3a972db0ef66dd672569afd8bf0281e71b82](https://hoodi.etherscan.io/tx/0xe34d1abc307eee6de446d48c8fbc3a972db0ef66dd672569afd8bf0281e71b82) — block 3882102
- approval: [0x6b5a5adc73401cb3306a89f4c38d814e239c9227f4be13275ae4844845c6678a](https://hoodi.etherscan.io/tx/0x6b5a5adc73401cb3306a89f4c38d814e239c9227f4be13275ae4844845c6678a) — block 3882102
- wstETHDeposit: [0xc82acfde330e9239003226101acf9b2f1c5019bedb46b33559ab5d19b4a2be65](https://hoodi.etherscan.io/tx/0xc82acfde330e9239003226101acf9b2f1c5019bedb46b33559ab5d19b4a2be65) — block 3882103
- privateWithdrawal: [0x122737f44310fef3f3c1467d3c7248dc963766262c823093b66bc4c97e6c98db](https://hoodi.etherscan.io/tx/0x122737f44310fef3f3c1467d3c7248dc963766262c823093b66bc4c97e6c98db) — block 3882106
- returnWstETH: [0x21ae96d1ca41a01bd919cf4710021e18a8f4706592dffbb629e0a200e5c0b1a0](https://hoodi.etherscan.io/tx/0x21ae96d1ca41a01bd919cf4710021e18a8f4706592dffbb629e0a200e5c0b1a0) — block 3882108
- returnETH: [0x39cecfdf652ed820f615ab8270d647d631db6fc0fdaefb56606ebd23c4f5c3b5](https://hoodi.etherscan.io/tx/0x39cecfdf652ed820f615ab8270d647d631db6fc0fdaefb56606ebd23c4f5c3b5) — block 3882110

[Machine-readable verification record](hoodi-verification.json)

Use the [shared vault](https://yieldveil.vercel.app/app?network=testnet) with a Hoodi wallet. There is no need to deploy another pool. Keep the current circuit and proving artifacts available for all existing notes.
