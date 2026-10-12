# Echoes architecture

Echoes is a Solana audio-storytelling product. People record a story, publish it, and earn when it is traded or sponsored. This document describes how the Android app (Kotlin, Jetpack Compose), the backend, and Solana fit together, and states which parts are shipped, partial, or not built.

Status legend: **Shipped** = in code and exercised. **Partial** = code exists but is gated, disabled, or only tested on an emulator. **Not built** = no code.

## 1. Components

```
Android app (Kotlin, Compose)        Backend (Next.js API + Supabase)         Solana
-----------------------------        --------------------------------         ------
MediaRecorder -> AAC/MP4             POST /api/upload -> storage bucket
Mobile Wallet Adapter (Seed Vault)   /api/auth/challenge, /verify -> JWT cookie
  signMessages  ------------------>  session established
Media3 ExoPlayer + MediaSession      GET /api/stories, /api/audio/{key}
Wallet signs server-built tx         /api/listing/tx, /api/unlock/tx   ----> signed transfer
  signAndSendTransactions            POST /api/stories, /api/unlock    <---- verifies signature on-chain
Blind vote (commit, then reveal)     /api/pool, /pool/vote, /pool/reveal
                                     /api/seeker/verify                <---- reads SGT via RPC
                                     /api/bags/*                       ----> Bags token launch
```

| Layer | Where | Notes |
|-------|-------|-------|
| Android client | `android/app/src/main/java/fans/echoes/client/` | `data/auth` wallet, `data/audio` recorder, `playback/` Media3, `ui/*` Compose screens, `data/repo` payments and pool |
| Backend API | `src/app/api/*` | Next.js route handlers, Supabase for metadata |
| On-chain program | `programs/echoes-voting/src/lib.rs` | Anchor: pool, entry, commit, reveal, finalize |
| Migrations | `migrations/` | Supabase SQL |

## 2. What happens where

### Recording (device, then backend)
1. The app records on device with `MediaRecorder` (up to 10 minutes, pausable) into a local file. The finished take is persisted so a killed app or failed payment does not lose it.
2. The review form collects title, description, category and cover.
3. On publish the file is uploaded through `POST /api/upload`; metadata is saved with `POST /api/stories`. Private audio is served only after an unlock is verified.

Status: **Shipped.** Verified on an emulator through to the review form; the final publish of a paid story was not completed on mainnet.

### Identity and ownership (device, backend, Solana)
1. The app asks Mobile Wallet Adapter to authorise. On a Seeker the wallet is Seed Vault.
2. The server issues a challenge (`/api/auth/challenge`). The wallet signs it with `signMessages`. This is a Sign In With Solana message, not a transaction, and costs nothing.
3. `/api/auth/verify` checks the signature and sets an HttpOnly session cookie, stored in the app in encrypted preferences.
4. The wallet address is the identity. Story owner and unlock buyer are wallet addresses.

Status: **Shipped.** Tested with the Solana Mobile fake wallet on an emulator, not yet on real Seed Vault hardware.

### Seeker verification (backend, Solana)
`POST /api/seeker/verify` reads the signed-in wallet's Token-2022 holdings via RPC and accepts a token only if its mint authority and group match the published Seeker Genesis Token values (`src/lib/seeker-genesis.ts`). One SGT binds to one account. `Build.MODEL == "Seeker"` only changes wording in the app; nothing is granted on it.

Status: **Partial.** Server check and the profile card exist. The card is shown only on a Seeker or an already-verified account, so it does not appear on a plain emulator.

### Payments (device, backend, Solana)
Listing fee (2,400 `$ECHOES`) and private-story unlock follow one pattern:
1. The app asks the server for an unsigned transaction (`/api/listing/tx`, `/api/unlock/tx`). The server decides amount and recipient; the app never builds a transaction.
2. The wallet signs and sends it with `signAndSendTransactions`.
3. The app sends the signature to the server, which fetches the transaction on-chain and checks the signer, mint, recipient and amount before listing the story or granting access (`src/lib/solana-payment-server.ts`).

Wallet states handled: waiting, approved, cancelled (silent return to the form), failed (message), no wallet installed.

Status: **Shipped** in code. The real-transfer success path is **untested**; the demo uses a simulated send.

### Tournament voting (device, backend, Solana)
Weekly cycle from a fixed epoch: 6 days of blind voting, then a 1-day reveal (`src/lib/pool-config.ts`). A vote is a commitment `keccak256(storyId + voter + salt)`; reveal is checked against it. The Anchor program moves SKR into a vault on `commit_vote` and adds stake weight to the story on `reveal_vote`. Intended split of pool revenue: 20% author, 70% voters, 10% platform.

Status: **Partial.**
- The on-chain program takes SKR; the server pool path currently weights votes in `$ECHOES`, and the server can require a minimum staked SKR (`MIN_STAKED_SKR`) before a vote.
- Weekly voting is disabled by decision in production (see `docs/plans/RELEASE_READINESS.md`).
- `finalize_pool` only marks the pool finished. Ranking and payouts are described as off-chain and no on-chain reward-distribution instruction exists.
- This repository contains no evidence of a mainnet deployment of the program.

### Token launches and trade-fee earnings (backend, Bags)
A story can be launched as a token through Bags (`/api/bags/fee-config`, `/api/bags/launch-txs`). Fee shares are set before launch and total 10,000 bps. Author launch: author 75%, platform 25%. Sponsor launch: sponsor 50%, author 25%, platform 25%. Trade fees are routed by the Bags fee-share configuration, so there is no backend payout job.

Status: **Partial.** Server routes and web UI exist. The Android app has no tokenisation screen.

### Creator payouts
Trade-fee earnings are paid by Bags per the fee-share config. Weekly prize payouts depend on the voting path above and are not automated on-chain.

## 3. Trust boundaries
- The server owns amounts, recipients and access decisions. The device signs only what the server builds.
- A purchase is real only after the server verifies the signature on-chain.
- Seeker status is decided on-chain by the SGT check, never by device model.
- Secrets (RPC keys, database keys, signing keys) live only in server environment and the owner's keystore; none are in this repository.

## 4. Not built
- SKR tipping: no code in the app, server or program.
- Payments in SKR: listing and unlock use `$ECHOES`.
- Sponsored launch from the Android app.
- Verification on physical Seeker hardware.
