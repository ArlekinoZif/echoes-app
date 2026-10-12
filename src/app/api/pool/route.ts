import { NextResponse } from "next/server";
import { getPoolConfig, getPoolPhase, POOL_MAX_ENTRIES } from "@/lib/pool-config";
import { dbFetchBallots, dbFetchPublicStories } from "@/lib/db-server";

export async function GET() {
  const config = getPoolConfig();
  const phase = getPoolPhase(config);

  const [stories, ballots] = await Promise.all([
    dbFetchPublicStories(),
    dbFetchBallots(config.poolId),
  ]);

  // Revealed ballots are the only ones that may be attributed to a story, so the
  // per-story tallies stay blind until the reveal window closes.
  const tally = new Map<string, { count: number; weight: number }>();
  for (const ballot of ballots) {
    if (!ballot.revealed || !ballot.storyId) continue;
    const current = tally.get(ballot.storyId) ?? { count: 0, weight: 0 };
    current.count += 1;
    current.weight += ballot.echoesAmount;
    tally.set(ballot.storyId, current);
  }

  const finalized = phase === "finalized";
  const entries = stories.slice(0, POOL_MAX_ENTRIES).map((story) => {
    const counted = tally.get(story.id);
    return {
      storyId: story.id,
      title: story.title,
      category: story.category,
      durationSeconds: story.durationSeconds,
      authorWallet: story.authorWallet ?? "",
      commitCount: 0,
      revealCount: finalized ? counted?.count ?? 0 : 0,
      totalEchoesWeight: finalized ? counted?.weight ?? 0 : 0,
      rank: 0,
    };
  });

  if (finalized) {
    [...entries]
      .sort((a, b) => b.totalEchoesWeight - a.totalEchoesWeight)
      .forEach((entry, index) => {
        if (entry.totalEchoesWeight > 0 && index < 3) {
          const target = entries.find((e) => e.storyId === entry.storyId);
          if (target) target.rank = index + 1;
        }
      });
  }

  return NextResponse.json({
    poolId: config.poolId,
    phase,
    voteCloseAt: config.voteCloseAt,
    revealCloseAt: config.revealCloseAt,
    echoesVoteCost: config.voteCost,
    skrVoteCost: config.voteCost, // legacy field name, kept for older clients
    solPrize: config.solPrize,
    totalVotes: ballots.length,
    entries,
    finalized,
  });
}
