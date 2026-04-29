# Echoes

**Blind commit-reveal voting + weekly SKR pool distribution for on-chain storytelling.**

Echoes lets writers submit audio stories to a weekly pool and lets the community vote on them using SKR tokens — without revealing their choice until the reveal phase. The top 3 stories split the prize pool.

---

## How It Works

1. **Record** — Authors record and submit an audio story to the current weekly pool
2. **Evaluate** — Community members listen and evaluate stories before voting
3. **Vote (blind)** — Voters commit `keccak256(story_id + voter_pubkey + salt)` on-chain and stake SKR tokens
4. **Reveal** — After voting closes, voters reveal their choice; the commitment is verified on-chain
5. **Finalize** — Admin finalizes the pool; top 3 stories by SKR weight win

Stories are stored on Arweave (permanent, decentralized). Votes are weighted by SKR staked.

---

## On-Chain Program

**Network:** Solana Devnet  
**Program ID:** `HyqZZPJoq2iqbbe8tMM9skB97K2tyim2ucqpzFp6xTpN`  
**Framework:** Anchor 0.30.1

### Instructions

| Instruction | Description |
|---|---|
| `initialize_pool` | Admin creates a new weekly pool with SKR vault and vote windows |
| `enter_pool` | Author submits a story (UUID + Arweave CID) to the pool |
| `commit_vote` | Voter submits a blind commitment hash + transfers SKR to vault |
| `reveal_vote` | Voter reveals story choice; commitment verified on-chain |
| `finalize_pool` | Admin closes the pool after reveal window ends |

### Accounts

- **WeeklyPool** — Pool state: timing windows, vault addresses, entry/vote counts
- **PoolEntry** — Per-story: author, Arweave CID, vote weight, rank
- **Ballot** — Per-voter: commitment hash, SKR amount, revealed flag

### Revenue Split (planned)
- 20% to winning authors
- 70% shared among top-100 voters who backed the winner
- 10% platform

---

## Stack

| Layer | Tech |
|---|---|
| Smart contract | Rust + Anchor 0.30.1 |
| Frontend | Next.js 15 (App Router) |
| Storage | Arweave (stories), Cloudflare R2 (temp audio) |
| Token | SKR (Seeker) |
| Wallet | Solana wallet adapter |

---

## Project Structure

```
programs/echoes-voting/   Anchor program (Rust)
src/app/                  Next.js pages
  record/                 Audio recording + upload
  evaluate/               Story evaluation feed
  vote/                   Voting UI
  dashboard/              Pool stats + leaderboard
  tokenize/               Story NFT minting
src/lib/                  Shared helpers (RPC, commit-reveal, Arweave, wallet)
src/idl/                  Program IDL (echoes_voting.json)
vendor/anchor-syn/        Patched anchor-syn (proc-macro2 compat fix)
```

---

## Building the Program

```bash
# Requires nightly-2025-03-15 (pinned via rust-toolchain.toml)
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

> **Note:** `rust-toolchain.toml` pins to `nightly-2025-03-15` and `vendor/anchor-syn` contains a patch that removes a `proc_macro2::Span::source_file()` call removed in proc-macro2 1.0.80+. Both are required for the build to succeed.

---

## Running the Frontend

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in your RPC URL, R2 credentials, and Arweave key.
