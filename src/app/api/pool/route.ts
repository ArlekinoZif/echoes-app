import { NextResponse } from "next/server";
import { pool } from "@/lib/pool-state";

export async function GET() {
  const now = Math.floor(Date.now() / 1000);
  const phase =
    now < pool.voteCloseAt ? "voting"
    : now < pool.revealCloseAt ? "reveal"
    : "finalized";

  // During voting phase: hide per-story vote counts to preserve blindness
  const entries = pool.entries.map((e) => ({
    ...e,
    // Only expose commitCount (just "N votes cast") — not which story
    totalSkrWeight: phase === "finalized" ? e.totalSkrWeight : 0,
    revealCount: phase === "finalized" ? e.revealCount : 0,
  }));

  return NextResponse.json({
    poolId: pool.poolId,
    phase,
    voteCloseAt: pool.voteCloseAt,
    revealCloseAt: pool.revealCloseAt,
    skrVoteCost: pool.skrVoteCost,
    solPrize: pool.solPrize,
    totalVotes: pool.ballots.length,
    entries,
    finalized: pool.finalized,
  });
}
