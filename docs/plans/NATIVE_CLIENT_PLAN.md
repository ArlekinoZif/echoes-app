# Echoes Seeker — native client plan (option A)

Date: 2026-09-19.

## Decision

The Seeker app becomes a **native Android client** that talks to the existing
Echoes REST API. The web product at `app.echoes.fans` is no longer wrapped, no
longer modified, and no longer coupled to the app in any way. One backend, two
independent front ends.

This supersedes the WebView shell in `seeker/native-app`, which stays in the
repository until the native client reaches parity.

## Why this shape

- The website's UI is a desktop-and-mobile web product owned by the web team.
  Wrapping it made every app requirement a change to their site. That coupling is
  what broke production twice and is now removed.
- The backend is already a plain REST API with a wallet-signed session, so a
  native client needs no new server concepts.
- Seed Vault signing, background playback, recording and the share sheet are all
  first-class natively, instead of being bridged through a WebView.

The cost, stated plainly: every feature the web team ships has to be implemented
a second time in the app. That is the price of the separation.

## Architecture

```
seeker/native-client/            ← new Gradle project (Kotlin, Jetpack Compose)
  app/src/main/java/fans/echoes/client/
    data/api/      Retrofit service, DTOs, cookie-backed session store
    data/auth/     Mobile Wallet Adapter + /api/auth challenge-response
    data/audio/    recording (MediaRecorder) and upload
    playback/      Media3 ExoPlayer + MediaSessionService
    ui/            Compose screens, theme, navigation
```

- **Networking**: Retrofit 3 + OkHttp 4 + kotlinx.serialization.
- **Session**: the server issues an HttpOnly JWT cookie. The client keeps it in a
  persistent `CookieJar` backed by `EncryptedSharedPreferences`; no server change
  is required. (A `Authorization: Bearer` path can be added later if a non-cookie
  client appears.)
- **Wallet**: `com.solanamobile:mobile-wallet-adapter-clientlib-ktx:2.0.8`.
  Authorize once, then `signMessages` for the login challenge and
  `signAndSendTransactions` for payments. On a Seeker this is Seed Vault.
- **Playback**: Media3 `ExoPlayer` inside a `MediaSessionService`, which gives
  lock-screen controls and background playback natively.
- **Images**: Coil 3.

Versions were checked against Maven Central and Google Maven on 2026-09-19:
compose-bom 2026.09.00, media3 1.11.1, activity-compose 1.13.0,
lifecycle-runtime-compose 2.11.0, retrofit 3.0.0, okhttp 4.12.0,
kotlinx-serialization-json 1.9.0, coil3 3.2.0.

## Server API the client consumes

Read (no session): `GET /api/stories`, `GET /api/stories/{id}`, `GET /api/pool`,
`GET /api/profiles?wallets=`, `GET /api/echoes-price`, `GET /api/reports`.

Session required: `POST /api/auth/challenge` → `POST /api/auth/verify` →
`GET /api/auth/session`, `POST /api/auth/logout`; `POST /api/upload`,
`POST /api/stories`, `POST /api/evaluations`, `POST /api/favourites`,
`GET|POST /api/profile`, `GET /api/referral`, `POST /api/reports`,
`DELETE /api/account`, `POST /api/pool/vote`, `POST /api/pool/reveal`,
`GET /api/unlock/tx`, `POST /api/unlock`, `GET|POST /api/bags-swap`,
`/api/bags/*`, `GET /api/audio/{key}` for private audio.

Nothing new is required on the server for phases 1–5.

## Phases

| Phase | Content | Done when |
|-------|---------|-----------|
| 0 ✅ | Gradle project, Compose scaffold, brand theme, app icon, `fans.echoes.app` (`.dev` suffix on debug so it can sit beside the old shell) | app launches on the emulator |
| 1 ✅ | API layer: DTOs, Retrofit service, persistent cookie jar, error mapping; connectivity screen showing live story count | live data from `app.echoes.fans` renders |
| 2 ✅ | Auth: MWA authorize → challenge → `signMessages` → verify → session; session restore on launch; logout | signed-in state survives an app restart |
| 3 ✅ | Library: feed, category filter, search, story detail, Media3 playback with lock-screen controls | a story plays with the screen locked |
| 4 ✅ | Record: permission, MediaRecorder (AAC/MP4), review form, upload, publish under the community-review gate | a story recorded on device appears in the feed |
| 5 ✅ | Evaluate, favourites, profile, referral, weekly pool with commit–reveal | parity with the web product's non-payment features |
| 6 ◑ | Payments through MWA. **Unlock and the listing fee are implemented**; both follow the same rule — the server builds the transaction, the wallet signs and submits, the server verifies it on-chain. Tokenisation through Bags and the swap are not written yet. | a private story unlocks after a real payment |
| 7 ✅ | Policy: report content, delete account, privacy screen and public policy URL, offline and error states | store policy requirements met |
| 8 ◑ | Release: `build-release.sh` (verifies package, certificate, API endpoint), App Links for `/recordings/*` with `assetlinks.json` live, share links, dApp Store copy and screenshots. **Remaining: run the script with the keystore password, fill the publisher fields, submit.** | signed APK + submission package |

Phases 0–3 are the usable core; 4–6 make it the full product; 7–8 ship it.

## What carries over from the WebView shell

- The release signing setup and `build-release.sh` pattern.
- `assetlinks.json` and the App Links intent filter (same package name).
- The dApp Store listing folder.
- Nothing else: the bridge, the media-session bridge and the WebView hardening
  become unnecessary because the equivalent is native.

## Verified so far

- Live feed, search and category filter against `app.echoes.fans`.
- Sign-in through Mobile Wallet Adapter with the official mock wallet: the wallet
  displayed the server's challenge, returned a 64-byte signature, and the server
  issued a session that survives an app restart.
- Background playback: position kept advancing with the app backgrounded and the
  screen off, with a platform media notification.
- Record and publish: an 8-second recording uploaded as `audio/mp4` and the story
  was accepted with the exact field set the API requires.
- Community review: scores 3/2/4 accepted with the measured listened percentage,
  and the same story could not be reviewed twice.
- Favourites toggle, profile save (age, country, languages sent under the
  caller's own identity) and the referral code with its join count.
- Weekly pool: a blind vote was committed as a SHA-256 digest, and the reveal was
  accepted because the server recomputed `sha256(storyId + voter + salt)` and got
  the same value — the client's hashing matches the server's algorithm.
- Listing fee, up to the wallet boundary: the review form offers "Community
  review (free)" or "Publish now (2400 $ECHOES)"; the paid path requests the
  transaction with its own wallet as payer and hands it to the wallet, and the
  stub rejects a story claiming `listed` without a payment signature exactly as
  production does (HTTP 402).
- A finished recording now survives the app being killed: after force-stopping
  the app mid-flow, the review form came back with the audio and the typed title
  intact. Before the fix, a failed payment cost the person their recording.
- Unlock payment, up to the wallet boundary: a private recording shows its price
  instead of a player, the client requests the unsigned transfer with its own
  wallet as the buyer, and hands it to the wallet. A cancelled wallet interaction
  returns to the story with a dismissible message and no crash. Completing a real
  transfer needs a funded wallet, so the success path belongs to the hardware
  test rather than the emulator.

Two defects found and fixed by testing rather than by reading:

- kotlinx.serialization omits fields equal to their Kotlin default, so a story
  whose `publishGate` was "evaluate" was posted without that field and rejected.
  `encodeDefaults` is now on.
- Compose 1.12 and lifecycle 2.11 demand AGP 9.1 and compileSdk 37 while the
  store still requires targetSdk 36; the dependency set is pinned to the last
  line that works, with the reason recorded in `app/build.gradle`.

## Server addition required by the native client

`GET /api/listing/tx?wallet=` (new, in this repository) builds the unsigned
2400 $ECHOES listing payment. The web client assembles that transaction in the
browser, which a native client should not do: it would need a transaction-building
stack on the device, and neither the amount nor the recipient should be decided
there. The route mirrors `GET /api/unlock/tx`, and `POST /api/stories` still
verifies the resulting signature on-chain before a story is listed.

Together with `/api/auth/*`, this is the full set of server routes the app needs
that production does not have yet. All of them are additive.

## Risks

- **Feature drift.** The web product keeps moving; the app must follow by hand.
  Mitigation: the API is the contract, and any new screen is additive.
- **Payment correctness.** Transactions are built server-side today; the client
  only signs and sends. That boundary must not move into the app.
- **Seed Vault behaviour** can only be fully verified on real Seeker hardware;
  the emulator shows the protocol, not the secure element.
