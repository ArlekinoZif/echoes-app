"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, Eye, EyeOff, Loader2, CheckCircle, Clock, Coins } from "lucide-react";
import { connectWallet, getConnectedWallet } from "@/lib/wallet";
import { generateSalt, computeCommitment, saveSalt, getSalt } from "@/lib/commit-reveal";

type Phase = "voting" | "reveal" | "finalized";

interface PoolEntry {
  storyId: string;
  title: string;
  category: string;
  durationSeconds: number;
  commitCount: number;
  revealCount: number;
  totalSkrWeight: number;
  rank: number;
}

interface PoolData {
  poolId: number;
  phase: Phase;
  voteCloseAt: number;
  revealCloseAt: number;
  skrVoteCost: number;
  solPrize: number;
  totalVotes: number;
  entries: PoolEntry[];
  finalized: boolean;
}

function useCountdown(targetTs: number) {
  const [remaining, setRemaining] = useState(targetTs - Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setRemaining(targetTs - Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, [targetTs]);
  const d = Math.max(0, remaining);
  const days = Math.floor(d / 86400);
  const hours = Math.floor((d % 86400) / 3600);
  const mins = Math.floor((d % 3600) / 60);
  const secs = d % 60;
  return { days, hours, mins, secs, expired: d <= 0 };
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function VotePage() {
  const [pool, setPool] = useState<PoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [skrAmount, setSkrAmount] = useState(10);
  const [voting, setVoting] = useState(false);
  const [voted, setVoted] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPool = useCallback(async () => {
    const res = await fetch("/api/pool");
    const data = await res.json();
    setPool(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPool();
    const addr = getConnectedWallet();
    if (addr) setWallet(addr);
  }, [loadPool]);

  const countdown = useCountdown(
    pool?.phase === "voting" ? pool.voteCloseAt : pool?.revealCloseAt ?? 0
  );

  const handleConnect = async () => {
    try {
      const addr = await connectWallet();
      setWallet(addr);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Wallet connection failed");
    }
  };

  const handleVote = async () => {
    if (!wallet || !selected || !pool) return;
    setVoting(true);
    setError(null);
    try {
      const salt = generateSalt();
      const commitment = await computeCommitment(selected, wallet, salt);

      const res = await fetch("/api/pool/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voter: wallet, commitment, skrAmount }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      // Save salt locally — needed for reveal
      saveSalt(pool.poolId, selected, salt);
      setVoted(true);
      await loadPool();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Vote failed");
    } finally {
      setVoting(false);
    }
  };

  const handleReveal = async () => {
    if (!wallet || !pool) return;
    setRevealing(true);
    setError(null);

    // Find which story we voted for by trying all entries
    let revealedStory: string | null = null;
    for (const entry of pool.entries) {
      const salt = getSalt(pool.poolId, entry.storyId);
      if (salt) { revealedStory = entry.storyId; break; }
    }

    if (!revealedStory) {
      setError("No saved vote found for this pool.");
      setRevealing(false);
      return;
    }

    const salt = getSalt(pool.poolId, revealedStory)!;
    try {
      const res = await fetch("/api/pool/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voter: wallet, storyId: revealedStory, salt }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setRevealed(true);
      await loadPool();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reveal failed");
    } finally {
      setRevealing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!pool) return null;

  const sortedEntries = [...pool.entries].sort((a, b) => b.totalSkrWeight - a.totalSkrWeight);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="p-2 rounded-full hover:bg-neutral-800 transition-colors text-neutral-400">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Weekly pool</h1>
            <p className="text-sm text-neutral-500">
              {pool.phase === "voting" ? "Blind voting — others can't see your choice" :
               pool.phase === "reveal" ? "Reveal phase — reveal your vote to count" :
               "Results — winners announced"}
            </p>
          </div>
        </div>

        {/* Pool stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-center">
            <p className="text-2xl font-bold text-amber-400">{pool.solPrize} SOL</p>
            <p className="text-xs text-neutral-500 mt-1">Prize pool</p>
          </div>
          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-center">
            <p className="text-2xl font-bold">{pool.totalVotes}</p>
            <p className="text-xs text-neutral-500 mt-1">Votes cast</p>
          </div>
          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-center">
            <p className="text-2xl font-bold">{pool.entries.length}</p>
            <p className="text-xs text-neutral-500 mt-1">Stories</p>
          </div>
        </div>

        {/* Countdown */}
        {!countdown.expired && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-neutral-900 border border-neutral-800 mb-8">
            <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-neutral-500 mb-1">
                {pool.phase === "voting" ? "Voting closes in" : "Reveal closes in"}
              </p>
              <p className="font-mono font-bold text-lg">
                {countdown.days > 0 && `${countdown.days}d `}
                {String(countdown.hours).padStart(2, "0")}:
                {String(countdown.mins).padStart(2, "0")}:
                {String(countdown.secs).padStart(2, "0")}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1 text-xs text-neutral-500">
              {pool.phase === "voting" ? (
                <><EyeOff className="w-4 h-4" /> Blind</>
              ) : (
                <><Eye className="w-4 h-4" /> Reveal</>
              )}
            </div>
          </div>
        )}

        {/* Wallet connect */}
        {!wallet && (
          <button
            onClick={handleConnect}
            className="w-full py-3 mb-6 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-semibold transition-colors"
          >
            Connect Phantom to vote
          </button>
        )}

        {/* Stories */}
        <div className="flex flex-col gap-3 mb-6">
          {sortedEntries.map((entry, i) => {
            const isSelected = selected === entry.storyId;
            const isWinner = entry.rank > 0;

            return (
              <button
                key={entry.storyId}
                disabled={pool.phase !== "voting" || voted || !wallet}
                onClick={() => setSelected(isSelected ? null : entry.storyId)}
                className={`p-5 rounded-2xl border-2 text-left transition-colors w-full ${
                  isWinner
                    ? "border-amber-500 bg-amber-500/10"
                    : isSelected
                    ? "border-amber-400 bg-amber-500/5"
                    : "border-neutral-800 bg-neutral-900 hover:border-neutral-600 disabled:hover:border-neutral-800"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isWinner && (
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
                          <Trophy className="w-3 h-3" /> #{entry.rank}
                        </span>
                      )}
                      <span className="text-xs text-amber-500 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full">
                        {entry.category}
                      </span>
                      <span className="text-xs text-neutral-600">{fmt(entry.durationSeconds)}</span>
                    </div>
                    <p className="font-semibold">{entry.title}</p>

                    {/* Vote counts — hidden during voting phase */}
                    <div className="flex items-center gap-3 mt-2">
                      {pool.phase === "voting" ? (
                        <span className="text-xs text-neutral-600 flex items-center gap-1">
                          <EyeOff className="w-3 h-3" /> Results hidden until reveal
                        </span>
                      ) : (
                        <>
                          <span className="text-xs text-neutral-400 flex items-center gap-1">
                            <Coins className="w-3 h-3 text-amber-500" />
                            {entry.totalSkrWeight.toLocaleString()} SKR
                          </span>
                          <span className="text-xs text-neutral-600">
                            {entry.revealCount} reveals
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {pool.phase === "voting" && !voted && wallet && (
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 ${
                      isSelected ? "border-amber-400 bg-amber-400" : "border-neutral-600"
                    }`} />
                  )}

                  {pool.phase === "voting" && (
                    <span className="text-xs text-neutral-600 flex-shrink-0 self-start">
                      {entry.commitCount} votes
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Vote action */}
        {pool.phase === "voting" && wallet && !voted && (
          <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm text-neutral-300">SKR to stake</label>
              <span className="text-xs text-neutral-500">min {pool.skrVoteCost} SKR</span>
            </div>
            <div className="flex gap-2 mb-4">
              {[10, 25, 50, 100].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setSkrAmount(amt)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    skrAmount === amt
                      ? "bg-amber-500 text-black"
                      : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                  }`}
                >
                  {amt}
                </button>
              ))}
            </div>
            <button
              onClick={handleVote}
              disabled={!selected || voting}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black rounded-xl font-semibold transition-colors"
            >
              {voting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Committing vote…
                </span>
              ) : selected ? (
                `Vote with ${skrAmount} SKR — hidden until reveal`
              ) : (
                "Select a story to vote"
              )}
            </button>
          </div>
        )}

        {voted && !revealed && pool.phase === "voting" && (
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500 text-center">
            <CheckCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="font-semibold">Vote committed!</p>
            <p className="text-sm text-neutral-400 mt-1">
              Come back during the reveal phase to make your vote count.
            </p>
          </div>
        )}

        {pool.phase === "reveal" && wallet && !revealed && (
          <button
            onClick={handleReveal}
            disabled={revealing}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black rounded-xl font-semibold transition-colors"
          >
            {revealing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Revealing…
              </span>
            ) : "Reveal my vote"}
          </button>
        )}

        {revealed && (
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500 text-center">
            <CheckCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="font-semibold">Vote revealed!</p>
            <p className="text-sm text-neutral-400 mt-1">
              You&apos;re in the top-100 voter reward pool if your story wins.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-900/20 border border-red-800 text-sm text-red-400">
            {error}
            {error.includes("staked") && (
              <a
                href="https://seeker.app"
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-2 text-amber-400 hover:text-amber-300 underline"
              >
                Stake SKR on Seeker →
              </a>
            )}
          </div>
        )}

        {/* Reward split info */}
        <div className="mt-8 p-5 rounded-2xl bg-neutral-900 border border-neutral-800">
          <p className="text-sm font-medium text-neutral-300 mb-3">Prize distribution</p>
          <div className="flex flex-col gap-2 text-sm text-neutral-500">
            <div className="flex justify-between">
              <span>Top 3 authors</span>
              <span className="text-white">20% each</span>
            </div>
            <div className="flex justify-between">
              <span>Top 100 voters (shared)</span>
              <span className="text-white">70%</span>
            </div>
            <div className="flex justify-between">
              <span>Platform</span>
              <span className="text-white">10%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
