# Voice-over script

Spoken text for the two demo recordings. Matching `.srt` caption files are in `recordings/`.

## Video 1: sign-in, library, vote, playback, recording

- `00:00` This is Echoes, a native Kotlin and Jetpack Compose app for Solana Mobile, where people record real stories and earn from them.
- `00:08` Sign-in uses Mobile Wallet Adapter. The server issues a challenge, and the wallet signs one login message. It is not a transaction and costs nothing. Here a test wallet stands in for Seed Vault.
- `00:19` Once signed in, the app keeps a secure session and loads the live library from the Echoes backend.
- `00:25` The Zone tab shows the connected wallet, an invite code for bringing friends, and optional profile details.
- `00:36` These let listeners find stories by audience, so the app stays useful beyond a single wallet.
- `00:41` Next, the Vote tab. Every week the community runs a blind vote on the pool of stories.
- `00:48` Votes stay sealed until the reveal phase, and the winning storyteller takes the prize pool, paid in SOL.
- `00:55` Back in the library, we open a story.
- `01:00` Each story has a cover, a description, and listener reviews for audio quality and storytelling.
- `01:10` Playback runs on Media3 ExoPlayer, with a progress bar, so audio can keep going with system media controls.
- `01:18` Now recording. Tapping Record starts the turntable and the microphone.
- `01:30` The tonearm drops and the take runs for up to ten minutes. It can be paused at any time.
- `01:41` When the take is finished, the sleeve opens. The creator adds a title, a description and a category, then chooses how to publish.

## Video 2: wallet-signed payment and publish

- `00:01` This is the wallet-signed payment flow. Creators can publish for free through community review, or pay a listing fee of twenty four hundred Echoes tokens to go live immediately.
- `00:17` The server builds the transaction and the wallet asks the user to approve it. The app never builds a transaction or picks an amount itself. Declining returns cleanly to the form, and nothing is spent.
- `00:34` Now we try again, and approve.
- `00:38` The wallet moves on to sending the transaction. For this demo, the send is simulated and nothing is submitted to mainnet.
- `00:46` In production, the app passes the signature to the server, which verifies the payment on-chain before the story is listed.
- `00:55` The app then returns to a fresh recording screen, ready for the next story.

Notes: a test wallet stands in for Seed Vault, and the payment send is simulated, not submitted to mainnet.
