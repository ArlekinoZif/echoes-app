# Release plan

Where the Android app stands and what remains before a public store release. Status as of 2026-10-13.

## Done
- Native Kotlin and Jetpack Compose client: Mobile Wallet Adapter sign-in, library, playback with media controls, recording, weekly pool screen, wallet-signed listing and unlock payments, profile with Seeker verification card.
- Server routes for auth, Seeker Genesis Token verification, listing and unlock transactions with on-chain verification, reports, and the pool.
- Test build published as a pre-release (debug-signed, package `fans.echoes.app.qa`).
- Verified on an Android emulator with the Solana Mobile fake wallet: sign-in, library, playback, recording, wallet-signing prompt, decline path.

## Before a store release
1. **Release signing.** Build with the team's upload key via `android/build-release.sh`; the script checks package name, certificate and API endpoint. The key stays outside the repository.
2. **Real hardware.** Install the signed release on a physical Seeker and complete Seed Vault connect and signing, recording, listing, unlock and playback checks. A real transfer success path has not been exercised.
3. **Migrations.** Apply `migrations/004_secure_private_unlocks.sql` and `006_reports.sql` to production so unlock and reports work.
4. **Weekly voting.** Deploy the persistent, on-chain weekly pool with real token-stake collection, then enable it. It is disabled in production today.
5. **Store listing.** Complete dApp Store metadata, screenshots, privacy policy and release declarations.

## Product gaps
| Item | State |
|------|-------|
| SKR tipping | Not built |
| Payments in SKR | Listing and unlock use `$ECHOES` |
| Sponsored token launch in the Android app | Server routes and web UI exist; no native screen |
| On-chain reward distribution | `finalize_pool` only marks a pool finished |
| Program deployment evidence | `declare_id!` is set; no mainnet deployment evidence in this repository |
