import { NextRequest, NextResponse } from "next/server";
import { getPoolConfig, MIN_STAKED_SKR } from "@/lib/pool-config";
import { dbSaveBallot } from "@/lib/db-server";
import { getStakedSKR } from "@/lib/rpc";
import { assertOwnIdentity, authErrorResponse, requireUser } from "@/lib/auth-server";

export async function POST(req: NextRequest) {
  let userId: string;
  try { userId = await requireUser(req); } catch (error) { return authErrorResponse(error); }

  const body = await req.json();
  const { voter, commitment } = body;
  // Older clients send skrAmount; newer ones send echoesAmount.
  const amount = Number(body.echoesAmount ?? body.skrAmount ?? 1);
  if (!voter || !commitment) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  try { assertOwnIdentity(userId, voter); } catch (error) { return authErrorResponse(error); }

  const config = getPoolConfig();
  if (Math.floor(Date.now() / 1000) >= config.voteCloseAt) {
    return NextResponse.json({ error: "Voting closed" }, { status: 400 });
  }
  if (config.voteCost > 0 && amount < config.voteCost) {
    return NextResponse.json(
      { error: `Minimum ${config.voteCost} $ECHOES required` },
      { status: 400 }
    );
  }

  if (MIN_STAKED_SKR > 0) {
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
  }

  const saved = await dbSaveBallot(config.poolId, voter, commitment, amount);
  if (!saved.ok && saved.reason === "already_voted") {
    return NextResponse.json({ error: "Already voted" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
