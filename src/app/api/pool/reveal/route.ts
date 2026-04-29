import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pool-state";

export async function POST(req: NextRequest) {
  const { voter, storyId, salt } = await req.json();
  if (!voter || !storyId || !salt) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now < pool.voteCloseAt) {
    return NextResponse.json({ error: "Voting still open" }, { status: 400 });
  }
  if (now >= pool.revealCloseAt) {
    return NextResponse.json({ error: "Reveal window closed" }, { status: 400 });
  }

  const ballot = pool.ballots.find((b) => b.voter === voter);
  if (!ballot) return NextResponse.json({ error: "No ballot found" }, { status: 404 });
  if (ballot.revealed) return NextResponse.json({ error: "Already revealed" }, { status: 409 });

  // Verify commitment (mirrors on-chain keccak256 check)
  const { createHash } = await import("crypto");
  const preimage = storyId + voter + salt;
  const computed = createHash("sha256").update(preimage).digest("hex");
  if (computed !== ballot.commitment) {
    return NextResponse.json({ error: "Commitment mismatch" }, { status: 400 });
  }

  ballot.revealed = true;
  ballot.storyId = storyId;

  const entry = pool.entries.find((e) => e.storyId === storyId);
  if (entry) {
    entry.revealCount += 1;
    entry.totalSkrWeight += ballot.skrAmount;
  }

  return NextResponse.json({ ok: true });
}
