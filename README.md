# Echoes

It’s SirHi, founder of Echoes.

This app was built during the Bags and Colosseum hackathons, but it quickly evolved into something bigger - a new market and new opportunities for creators. Anyone with real experiences can share their stories, turn memories into tradable IP, and earn from them.
Echoes is constantly evolving. I appreciate your feedback and I`m always open to networking and collaboration - https://linktr.ee/SirHi

# What is Echoes?

Echoes is a Web3 audio storytelling platform built on Solana. It lets real people record their stories, lessons, and experiences and turn them into tradeable digital tokens that are stored forever on the blockchain.

# Why it matters:

- A war veteran's story doesn't disappear when they're gone.
- A trader's hard-won lesson has real value and can be monetized.
- Any voice worth hearing can become a permanent piece of human history.
  
Every story is an audio recording. Every recording can become a token. Every token can be bought, sold, and traded — and the original author earns from every trade.

# Flow:

1. Record:
A person records up to 5 minutes of audio inside the app.

2. List:
The story is published on Echoes (stored temporarily on Cloudflare).

3. Tokenize:
The story gets a unique token launched on Bags and stored permanently on Arweave. This can be done by the author, or by any listener.

4. Trade:
Anyone can buy and sell the story token on Bags.

5. Earn:
The author receives up to 0.75% of all trading volume, forever.

# Test it

App MVP is available at [app.echoes](https://app.echoes.fans/zone)

# Android app (Solana Seeker)

A native Kotlin and Jetpack Compose client for Echoes, built for Solana Mobile and Seeker owners. It signs in with Mobile Wallet Adapter (Seed Vault on a Seeker), records and plays stories, takes part in the weekly blind-vote pool, and pays listing and unlock fees by wallet signature.

- **Download:** [Release v1.0.0-qa](https://github.com/ArlekinoZif/echoes-app/releases/tag/v1.0.0-qa), a debug-signed test build for sideloading (Android 8.0+).
- **Source:** `android/`
- **Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), including what is shipped, partial, and not built.
- **Submission pack:** [docs/SUBMISSION.md](docs/SUBMISSION.md)
- **Plans:** [docs/plans/](docs/plans/)
- **Demo videos with voice-over and captions:** [demo/](demo/)

## Honest status

Verified on an Android emulator with a test wallet. Not yet verified on a physical Seeker with real Seed Vault. SKR tipping and in-app sponsored launches are not built. See the architecture document for the full list.

Build: `cd android && ./gradlew assembleDebug`.
