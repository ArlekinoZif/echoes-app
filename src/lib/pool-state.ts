// Shared in-memory pool state for API stubs.
// Replace with Anchor program reads once deployed to devnet.

export interface PoolEntry {
  storyId: string;
  title: string;
  category: string;
  durationSeconds: number;
  authorWallet: string;
  commitCount: number;  // visible during voting
  revealCount: number;  // visible after reveal phase
  totalSkrWeight: number; // only non-zero after reveal
  rank: number;         // 0 = unranked, 1-3 = winner
}

export interface Ballot {
  voter: string;
  commitment: string; // hex of keccak256(storyId + voter + salt)
  skrAmount: number;
  revealed: boolean;
  storyId?: string;   // set on reveal
}

export interface WeeklyPool {
  poolId: number;
  voteOpenAt: number;
  voteCloseAt: number;
  revealCloseAt: number;
  skrVoteCost: number; // SKR tokens per vote
  solPrize: number;    // SOL in pool
  entries: PoolEntry[];
  ballots: Ballot[];
  finalized: boolean;
}

// Singleton — lasts for the lifetime of the Next.js server process.
// In prod this is replaced by on-chain program account reads.
const now = Math.floor(Date.now() / 1000);
const WEEK = 7 * 24 * 60 * 60;

export const pool: WeeklyPool = {
  poolId: 1,
  voteOpenAt: now,
  voteCloseAt: now + WEEK,
  revealCloseAt: now + WEEK + 86400,
  skrVoteCost: 10,
  solPrize: 2.5,
  finalized: false,
  entries: [
    {
      storyId: "demo-1",
      title: "Crossing the border at 17",
      category: "Immigration",
      durationSeconds: 312,
      authorWallet: "DemoAuthor1111111111111111111111111111111111",
      commitCount: 14, revealCount: 0, totalSkrWeight: 0, rank: 0,
    },
    {
      storyId: "demo-2",
      title: "The night we almost lost everything",
      category: "Entrepreneurship",
      durationSeconds: 487,
      authorWallet: "DemoAuthor2222222222222222222222222222222222",
      commitCount: 9, revealCount: 0, totalSkrWeight: 0, rank: 0,
    },
    {
      storyId: "demo-3",
      title: "Letters my grandfather never sent",
      category: "War",
      durationSeconds: 541,
      authorWallet: "DemoAuthor3333333333333333333333333333333333",
      commitCount: 21, revealCount: 0, totalSkrWeight: 0, rank: 0,
    },
    {
      storyId: "demo-4",
      title: "Finding my son after 12 years",
      category: "Family",
      durationSeconds: 398,
      authorWallet: "DemoAuthor4444444444444444444444444444444444",
      commitCount: 6, revealCount: 0, totalSkrWeight: 0, rank: 0,
    },
    {
      storyId: "demo-5",
      title: "How I survived the earthquake alone",
      category: "Survival",
      durationSeconds: 623,
      authorWallet: "DemoAuthor5555555555555555555555555555555555",
      commitCount: 18, revealCount: 0, totalSkrWeight: 0, rank: 0,
    },
  ],
  ballots: [],
};
