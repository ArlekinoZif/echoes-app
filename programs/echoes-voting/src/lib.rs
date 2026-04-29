use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("HyqZZPJoq2iqbbe8tMM9skB97K2tyim2ucqpzFp6xTpN");

// Seeker token mint (mainnet) — used for vote staking
// pub const SKR_MINT: &str = "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3";
// SKR Staking Program: SKRskrmtL83pcL4YqLWt6iPefDqwXQWHSw9S9vz94BZ
// Stake Config:        4HQy82s9CHTv1GsYKnANHMiHfhcqesYkK6sB3RDSYyqw
// Stake Vault:         8isViKbwhuhFhsv2t8vaFL74pKCqaFPQXo1KkeQwZbB8
// Guardian Pool:       DPJ58trLsF9yPrBa2pk6UaRkvqW8hWUYjawe788WBuqr

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------
const WEEK_SECONDS: i64 = 7 * 24 * 60 * 60;
const REVEAL_WINDOW: i64 = 24 * 60 * 60; // 24h after voting closes
const MAX_POOL_ENTRIES: usize = 20;
const TOP_WINNERS: usize = 3;

// Revenue split basis points (out of 10_000)
const AUTHOR_BPS: u64 = 2_000;   // 20% to author
const VOTERS_BPS: u64 = 7_000;   // 70% shared among top-100 voters
const PLATFORM_BPS: u64 = 1_000; // 10% platform

// ------------------------------------------------------------------
// Program
// ------------------------------------------------------------------
#[program]
pub mod echoes_voting {
    use super::*;

    /// Admin creates a new weekly pool. Called once per week by the platform.
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        pool_id: u64,
        skr_vote_cost: u64, // lamports of SKR required per vote
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        let clock = Clock::get()?;

        pool.pool_id = pool_id;
        pool.authority = ctx.accounts.authority.key();
        pool.skr_mint = ctx.accounts.skr_mint.key();
        pool.skr_vault = ctx.accounts.skr_vault.key();
        pool.sol_vault = ctx.accounts.sol_vault.key();
        pool.vote_open_at = clock.unix_timestamp;
        pool.vote_close_at = clock.unix_timestamp + WEEK_SECONDS;
        pool.reveal_close_at = clock.unix_timestamp + WEEK_SECONDS + REVEAL_WINDOW;
        pool.skr_vote_cost = skr_vote_cost;
        pool.total_entries = 0;
        pool.total_votes = 0;
        pool.finalized = false;
        pool.bump = ctx.bumps.pool;

        emit!(PoolInitialized {
            pool_id,
            vote_close_at: pool.vote_close_at,
            reveal_close_at: pool.reveal_close_at,
        });

        Ok(())
    }

    /// Author enters their story into the current weekly pool.
    pub fn enter_pool(
        ctx: Context<EnterPool>,
        story_id: String,   // UUID from frontend
        arweave_cid: String, // Arweave tx ID (set if already uploaded, else empty)
    ) -> Result<()> {
        require!(story_id.len() <= 64, EchoesError::StoryIdTooLong);

        let pool = &ctx.accounts.pool;
        let clock = Clock::get()?;
        require!(clock.unix_timestamp < pool.vote_close_at, EchoesError::VotingClosed);
        require!((pool.total_entries as usize) < MAX_POOL_ENTRIES, EchoesError::PoolFull);

        let entry = &mut ctx.accounts.entry;
        entry.pool = pool.key();
        entry.author = ctx.accounts.author.key();
        entry.story_id = story_id.clone();
        entry.arweave_cid = arweave_cid;
        entry.commit_count = 0;
        entry.reveal_count = 0;
        entry.total_skr_weight = 0;
        entry.rank = 0;
        entry.bump = ctx.bumps.entry;

        let pool = &mut ctx.accounts.pool;
        pool.total_entries += 1;

        emit!(StoryEntered { story_id, pool: pool.key() });
        Ok(())
    }

    /// Voter commits a blind vote: stores hash(story_id + salt) so no one can
    /// see which story they voted for until the reveal phase.
    pub fn commit_vote(
        ctx: Context<CommitVote>,
        commitment: [u8; 32], // keccak256(story_id + voter_pubkey + salt)
        skr_amount: u64,      // SKR tokens staked with this vote (more = higher weight)
    ) -> Result<()> {
        let pool = &ctx.accounts.pool;
        let clock = Clock::get()?;
        require!(clock.unix_timestamp < pool.vote_close_at, EchoesError::VotingClosed);
        require!(skr_amount >= pool.skr_vote_cost, EchoesError::InsufficientStake);

        // Transfer SKR from voter to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.voter_skr.to_account_info(),
                    to: ctx.accounts.skr_vault.to_account_info(),
                    authority: ctx.accounts.voter.to_account_info(),
                },
            ),
            skr_amount,
        )?;

        let ballot = &mut ctx.accounts.ballot;
        ballot.pool = pool.key();
        ballot.voter = ctx.accounts.voter.key();
        ballot.commitment = commitment;
        ballot.skr_amount = skr_amount;
        ballot.story_entry = Pubkey::default(); // filled on reveal
        ballot.revealed = false;
        ballot.bump = ctx.bumps.ballot;

        let pool = &mut ctx.accounts.pool;
        pool.total_votes += 1;

        emit!(VoteCommitted {
            voter: ballot.voter,
            skr_amount,
        });
        Ok(())
    }

    /// Voter reveals their vote after voting closes. Verifies the commitment.
    pub fn reveal_vote(
        ctx: Context<RevealVote>,
        story_id: String,
        salt: [u8; 32],
    ) -> Result<()> {
        let pool = &ctx.accounts.pool;
        let clock = Clock::get()?;
        require!(clock.unix_timestamp >= pool.vote_close_at, EchoesError::VotingStillOpen);
        require!(clock.unix_timestamp < pool.reveal_close_at, EchoesError::RevealWindowClosed);

        let ballot = &mut ctx.accounts.ballot;
        require!(!ballot.revealed, EchoesError::AlreadyRevealed);

        // Verify commitment: hash(story_id_bytes + voter_pubkey + salt)
        let mut preimage = Vec::new();
        preimage.extend_from_slice(story_id.as_bytes());
        preimage.extend_from_slice(&ballot.voter.to_bytes());
        preimage.extend_from_slice(&salt);
        let computed = anchor_lang::solana_program::keccak::hash(&preimage).0;
        require!(computed == ballot.commitment, EchoesError::InvalidReveal);

        ballot.revealed = true;
        ballot.story_entry = ctx.accounts.entry.key();

        let entry = &mut ctx.accounts.entry;
        entry.reveal_count += 1;
        entry.total_skr_weight += ballot.skr_amount;

        emit!(VoteRevealed {
            voter: ballot.voter,
            story_id,
            skr_amount: ballot.skr_amount,
        });
        Ok(())
    }

    /// Admin finalizes pool after reveal window. Ranks stories, marks top 3,
    /// distributes SOL pool rewards.
    pub fn finalize_pool(ctx: Context<FinalizePool>) -> Result<()> {
        let pool = &ctx.accounts.pool;
        let clock = Clock::get()?;
        require!(clock.unix_timestamp >= pool.reveal_close_at, EchoesError::RevealWindowStillOpen);
        require!(!pool.finalized, EchoesError::AlreadyFinalized);

        let pool = &mut ctx.accounts.pool;
        pool.finalized = true;

        // Note: Ranking and reward distribution is handled off-chain by reading
        // revealed vote accounts, then calling distribute_rewards for each winner.
        // This keeps this instruction lightweight and avoids iteration limits.

        emit!(PoolFinalized { pool_id: pool.pool_id });
        Ok(())
    }
}

// ------------------------------------------------------------------
// Accounts
// ------------------------------------------------------------------
#[derive(Accounts)]
#[instruction(pool_id: u64)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        space = WeeklyPool::LEN,
        seeds = [b"pool", pool_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub pool: Account<'info, WeeklyPool>,

    /// CHECK: SKR token mint — validated by skr_vault constraint
    pub skr_mint: UncheckedAccount<'info>,

    #[account(
        token::mint = skr_mint,
        token::authority = pool,
    )]
    pub skr_vault: Account<'info, TokenAccount>,

    /// CHECK: SOL escrow — a system account PDA
    #[account(
        seeds = [b"sol-vault", pool_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub sol_vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(story_id: String)]
pub struct EnterPool<'info> {
    #[account(mut, has_one = authority @ EchoesError::Unauthorized)]
    pub pool: Account<'info, WeeklyPool>,

    #[account(
        init,
        payer = author,
        space = PoolEntry::LEN,
        seeds = [b"entry", pool.key().as_ref(), story_id.as_bytes()],
        bump,
    )]
    pub entry: Account<'info, PoolEntry>,

    #[account(mut)]
    pub author: Signer<'info>,

    /// CHECK: pool authority — validated by has_one
    pub authority: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CommitVote<'info> {
    #[account(mut)]
    pub pool: Account<'info, WeeklyPool>,

    #[account(
        init,
        payer = voter,
        space = Ballot::LEN,
        seeds = [b"ballot", pool.key().as_ref(), voter.key().as_ref()],
        bump,
    )]
    pub ballot: Account<'info, Ballot>,

    #[account(mut, token::mint = pool.skr_mint, token::authority = voter)]
    pub voter_skr: Account<'info, TokenAccount>,

    #[account(mut, address = pool.skr_vault)]
    pub skr_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub voter: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(story_id: String)]
pub struct RevealVote<'info> {
    pub pool: Account<'info, WeeklyPool>,

    #[account(
        mut,
        seeds = [b"ballot", pool.key().as_ref(), voter.key().as_ref()],
        bump = ballot.bump,
        has_one = voter,
    )]
    pub ballot: Account<'info, Ballot>,

    #[account(
        mut,
        seeds = [b"entry", pool.key().as_ref(), story_id.as_bytes()],
        bump = entry.bump,
    )]
    pub entry: Account<'info, PoolEntry>,

    pub voter: Signer<'info>,
}

#[derive(Accounts)]
pub struct FinalizePool<'info> {
    #[account(mut, has_one = authority @ EchoesError::Unauthorized)]
    pub pool: Account<'info, WeeklyPool>,
    pub authority: Signer<'info>,
}

// ------------------------------------------------------------------
// State
// ------------------------------------------------------------------
#[account]
pub struct WeeklyPool {
    pub pool_id: u64,
    pub authority: Pubkey,
    pub skr_mint: Pubkey,
    pub skr_vault: Pubkey,
    pub sol_vault: Pubkey,
    pub vote_open_at: i64,
    pub vote_close_at: i64,
    pub reveal_close_at: i64,
    pub skr_vote_cost: u64,
    pub total_entries: u32,
    pub total_votes: u32,
    pub finalized: bool,
    pub bump: u8,
}
impl WeeklyPool {
    pub const LEN: usize = 8 + 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 4 + 4 + 1 + 1;
}

#[account]
pub struct PoolEntry {
    pub pool: Pubkey,
    pub author: Pubkey,
    pub story_id: String,     // max 64 chars
    pub arweave_cid: String,  // max 64 chars
    pub commit_count: u32,
    pub reveal_count: u32,
    pub total_skr_weight: u64,
    pub rank: u8,             // 0 = unranked, 1-3 = winner
    pub bump: u8,
}
impl PoolEntry {
    pub const LEN: usize = 8 + 32 + 32 + (4 + 64) + (4 + 64) + 4 + 4 + 8 + 1 + 1;
}

#[account]
pub struct Ballot {
    pub pool: Pubkey,
    pub voter: Pubkey,
    pub commitment: [u8; 32],
    pub skr_amount: u64,
    pub story_entry: Pubkey,
    pub revealed: bool,
    pub bump: u8,
}
impl Ballot {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 32 + 1 + 1;
}

// ------------------------------------------------------------------
// Events
// ------------------------------------------------------------------
#[event]
pub struct PoolInitialized { pub pool_id: u64, pub vote_close_at: i64, pub reveal_close_at: i64 }
#[event]
pub struct StoryEntered { pub story_id: String, pub pool: Pubkey }
#[event]
pub struct VoteCommitted { pub voter: Pubkey, pub skr_amount: u64 }
#[event]
pub struct VoteRevealed { pub voter: Pubkey, pub story_id: String, pub skr_amount: u64 }
#[event]
pub struct PoolFinalized { pub pool_id: u64 }

// ------------------------------------------------------------------
// Errors
// ------------------------------------------------------------------
#[error_code]
pub enum EchoesError {
    #[msg("Voting period is closed")]
    VotingClosed,
    #[msg("Voting period is still open")]
    VotingStillOpen,
    #[msg("Reveal window has closed")]
    RevealWindowClosed,
    #[msg("Reveal window is still open")]
    RevealWindowStillOpen,
    #[msg("Pool is full (max 20 entries)")]
    PoolFull,
    #[msg("Insufficient SKR stake")]
    InsufficientStake,
    #[msg("Invalid vote reveal — commitment mismatch")]
    InvalidReveal,
    #[msg("Vote already revealed")]
    AlreadyRevealed,
    #[msg("Pool already finalized")]
    AlreadyFinalized,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Story ID too long")]
    StoryIdTooLong,
}
