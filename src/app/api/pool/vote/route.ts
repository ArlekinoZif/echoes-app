import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pool-state";
import { getStakedSKR } from "@/lib/rpc";

// Minimum SKR that must be staked in Seeker to participate in Echoes voting
const MIN_STAKED_SKR = 1;

export async function POST(req: NextRequest) {
  const { voter, commitment, skrAmount } = await req.json();
  if (!voter || !commitment || !skrAmount) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now >= pool.voteCloseAt) {
    return NextResponse.json({ error: "Voting closed" }, { status: 400 });
  }

  const existing = pool.ballots.find((b) => b.voter === voter);
  if (existing) {
    return NextResponse.json({ error: "Already voted" }, { status: 409 });
  }

  if (skrAmount < pool.skrVoteCost) {
    return NextResponse.json(
      { error: `Minimum ${pool.skrVoteCost} SKR required` },
      { status: 400 }
    );
  }

  // Verify voter has staked SKR in the Seeker staking program
  const { stakedUiAmount } = await getStakedSKR(voter);
  if (stakedUiAmount < MIN_STAKED_SKR) {
    return NextResponse.json(
      {
        error: `You need at least ${MIN_STAKED_SKR} SKR staked in Seeker to vote. Stake at seeker.app.`,
        code: "INSUFFICIENT_STAKED_SKR",
        stakedAmount: stakedUiAmount,
      },
      { status: 403 }
    );
  }

  pool.ballots.push({ voter, commitment, skrAmount, revealed: false });

  return NextResponse.json({ ok: true, totalVotes: pool.ballots.length });
}
