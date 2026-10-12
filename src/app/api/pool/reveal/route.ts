import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getPoolConfig } from "@/lib/pool-config";
import { dbFetchBallot, dbRevealBallot } from "@/lib/db-server";
import { assertOwnIdentity, authErrorResponse, requireUser } from "@/lib/auth-server";

export async function POST(req: NextRequest) {
  let userId: string;
  try { userId = await requireUser(req); } catch (error) { return authErrorResponse(error); }

  const { voter, storyId, salt } = await req.json();
  if (!voter || !storyId || !salt) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  try { assertOwnIdentity(userId, voter); } catch (error) { return authErrorResponse(error); }

  const config = getPoolConfig();
  const now = Math.floor(Date.now() / 1000);
  if (now < config.voteCloseAt) {
    return NextResponse.json({ error: "Voting still open" }, { status: 400 });
  }
  if (now >= config.revealCloseAt) {
    return NextResponse.json({ error: "Reveal window closed" }, { status: 400 });
  }

  const ballot = await dbFetchBallot(config.poolId, voter);
  if (!ballot) return NextResponse.json({ error: "No ballot found" }, { status: 404 });
  if (ballot.revealed) return NextResponse.json({ error: "Already revealed" }, { status: 409 });

  const computed = createHash("sha256").update(storyId + voter + salt).digest("hex");
  if (computed !== ballot.commitment) {
    return NextResponse.json({ error: "Commitment mismatch" }, { status: 400 });
  }

  await dbRevealBallot(config.poolId, voter, storyId);
  return NextResponse.json({ ok: true });
}
