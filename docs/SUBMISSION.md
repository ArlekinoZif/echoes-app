# Echoes Seeker — hackathon submission pack

Android app (Kotlin, Jetpack Compose) for recording and trading short audio stories on Solana, built for Seeker owners. This file covers the five submission items and states which parts are shipped, which are partial, and which are not built. Status is taken from the code in this repository, not from the product plan.

## 1. Working mobile demo (video)

The video must be recorded by a person on an emulator or Seeker. Suggested script (about 3 min), in order:

| # | Scene | Where in code |
|---|-------|---------------|
| 1 | Cold start, brand splash, "Connect Seed Vault" | `ui/auth/LoginScreen.kt` |
| 2 | Wallet sheet shows the challenge, user approves | `data/auth/WalletAuth.kt` (MWA `signMessages`) |
| 3 | Profile shows "Seeker verified" after SGT check | `data/SeekerDevice.kt`, `src/app/api/seeker/verify/route.ts` |
| 4 | Record a story, review form, publish | `ui/record/*`, `data/audio/AudioRecorder.kt` |
| 5 | Vinyl sleeve and playback, lock screen controls | `ui/story/Sleeve.kt`, `ui/theme/Vinyl.kt`, `playback/*` |
| 6 | Weekly pool: blind vote then reveal | `ui/pool/*`, `data/repo/PoolRepository.kt` |
| 7 | Wallet-signed payment: unlock a private story or pay the listing fee | `data/repo/PaymentRepository.kt` |
| 8 | Error states: cancel in wallet, offline, 503 | see section 5 |

Debug build: `cd android && ./gradlew assembleDebug`. A pre-built QA APK is at `android/dist/echoes-1.0.0-qa.apk`.

## 2. Repository evidence

| Claim | Evidence |
|-------|----------|
| Kotlin/Compose app | `android/app/src/main/java/fans/echoes/client/` |
| Solana Mobile Stack | `com.solanamobile:mobile-wallet-adapter-clientlib-ktx` in `android/app/build.gradle`; usage in `data/auth/WalletAuth.kt`, `WalletSessionService.kt` |
| Wallet signing | login: `signMessages`; payments: `signAndSendTransactions` in `PaymentRepository.kt` |
| SGT verification | server check `src/lib/seeker-genesis.ts`, route `api/seeker/verify`; one SGT binds to one account |
| Transaction handling | server builds, wallet signs, server verifies on-chain: `api/unlock/tx`, `api/listing/tx`, `lib/solana-payment-server.ts`, `lib/echoes-payment.ts` |
| On-chain program | `programs/echoes-voting/src/lib.rs` (Anchor): pool, entry, commit, reveal, finalize; SKR transferred to a vault on vote |
| Token launch and fee split | `api/bags/fee-config`, `api/bags/launch-txs` (Bags) |
| Backend API | `src/app/api/*`, migrations in `migrations/` |

## 3. Technical architecture

```
Device (Android, Compose)                Backend (Next.js API, Supabase)           Solana
-------------------------                --------------------------------           ------
MediaRecorder -> AAC/MP4                 POST /api/upload -> storage bucket
MWA -> Seed Vault signs  ------------>   /api/auth/challenge + /verify -> JWT cookie
Media3 playback + MediaSession           GET /api/stories, /api/audio/{key}
Unsigned tx from server -> wallet signs  /api/unlock/tx, /api/listing/tx    ---> transfer
  signAndSendTransactions                POST /api/unlock, /api/stories      <--- verifies signature on-chain
Pool vote: SHA-256 commit, later reveal  /api/pool/vote, /reveal             ---> echoes-voting program
                                         /api/seeker/verify                  <--- reads SGT holdings via RPC
                                         /api/bags/*                         ---> Bags token launch
```

- **Recordings.** Recorded on device, uploaded to storage, metadata in Supabase. Private audio is served only after an unlock is verified. The finished recording is persisted so a killed app or failed payment does not lose it.
- **Ownership.** The wallet is identity. A challenge signed in Seed Vault yields an HttpOnly session. Story owner and unlock buyer are wallet addresses. Seeker status is decided only by the on-chain SGT check; `Build.MODEL` only changes wording.
- **Payments.** The server decides amount and recipient and builds the transaction. The device only signs and sends. The server then checks the signature on-chain before listing a story or granting an unlock.
- **Token launches.** A story can be launched as a token through Bags. Fee shares are set before launch and must total 10,000 bps. Author launch: author 75%, platform 25%. Sponsor launch: sponsor 50%, author 25%, platform 25%.
- **Tournament voting.** Weekly cycle: 6 days blind voting, 1 day reveal. Vote is a SHA-256 commitment of `storyId + voter + salt`; reveal is checked against it. The Anchor program moves SKR to a vault and adds stake weight to the story on reveal.
- **Creator payouts and trade-fee earnings.** Trade fees are routed by the Bags fee-share config above, so authors and sponsors earn on-chain without a backend payout job. The dashboard reads these shares (`src/app/zone/page.tsx`, "Revenue Share").

## 4. Retention loop

1. Seeker owner records a story weekly, and it enters the tournament pool.
2. SKR holders vote blind during the week, then reveal; weight is stake.
3. The winner is finalized on-chain at the end of the week. The next pool opens on the same fixed weekly clock (`lib/pool-config.ts`).
4. Strong stories are sponsored: the sponsor pays for the launch and earns 50% of trading fees permanently.
5. Authors and sponsors return to see their fee share and the next round.

## 5. UX polish evidence

Capture these screens for the submission (screenshots or video frames):

- Onboarding: `LoginScreen` and wallet connect sheet.
- Recording: `RecordDeck`, then `PressingStage` (pressing animation), then the review form.
- Playback: `Sleeve` with spinning vinyl, lock screen notification.
- Wallet approval states: waiting, approved, cancelled (dismissible message, no crash), failed.
- Completed transaction: story unlocked after a real transfer.
- Errors: offline, server 503 for migrations not yet applied, report and delete-account flows.

## 6. Gaps — read before submitting

These items in the submission text are **not** met by the code today. Do not claim them in the video or write-up unless they are built first.

| Requested item | Current state |
|----------------|---------------|
| SKR voting in the app | Anchor program takes SKR, but the server pool vote cost is configured in `$ECHOES` and weekly voting is **disabled by decision** (`docs/plans/RELEASE_PLAN.md`). The app commit-reveal flow works against the server, not the SKR vault path. |
| SKR tipping | **No tipping code exists** in app, server or program. |
| Sponsored launch from the app | Server routes and web UI exist. The native client has **no tokenisation screen** (plan phase 6 is partial). |
| Payments in SKR | Unlock and listing fee use `$ECHOES`. |
| Real Seeker hardware | Verified on emulator with the mock wallet only. Success path of a real transfer is untested. |
| Program deployment | `declare_id!` is set; this repository contains no evidence of a mainnet deployment. |
| Production migrations | `004_secure_private_unlocks.sql` and `006_reports.sql` still pending, so unlock and reports return 503. |

Shortest path to close the biggest gaps: add a tip transfer (server `tip/tx` plus a button on `StoryScreen`), enable the pool with an SKR cost, add a sponsored-launch screen calling `api/bags/*`, run the pending migrations, then record the demo on a Seeker.
