"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getStories } from "@/lib/store";
import { Story } from "@/lib/types";
import { connectWallet, getConnectedWallet } from "@/lib/wallet";
import {
  ArrowLeft, Wallet, Coins, TrendingUp, CheckCircle,
  Clock, ExternalLink, Loader2, RefreshCw, BarChart3,
} from "lucide-react";

interface DashboardData {
  wallet: string;
  solBalance: number;
  skrBalance: number;
  stakedSkrBalance: number;
  stakeAccount: string | null;
  tokenCount: number;
  recentTxs: {
    signature: string;
    blockTime: number | null;
    fee: number;
    status: "success" | "failed";
  }[];
  estimatedFeeIncomeSol: number;
}

function StatCard({
  label, value, sub, icon,
}: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800">
      <div className="flex items-center gap-2 mb-3 text-neutral-500">{icon}<span className="text-xs font-medium uppercase tracking-wider">{label}</span></div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-neutral-600 mt-1">{sub}</p>}
    </div>
  );
}

function timeAgo(ts: number | null): string {
  if (!ts) return "unknown";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shortSig(sig: string): string {
  return `${sig.slice(0, 6)}…${sig.slice(-6)}`;
}

export default function DashboardPage() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (addr: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard?wallet=${addr}`);
      if (!res.ok) throw new Error((await res.json()).error);
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setStories(getStories());
    const addr = getConnectedWallet();
    if (addr) { setWallet(addr); fetchData(addr); }
  }, [fetchData]);

  const handleConnect = async () => {
    try {
      const addr = await connectWallet();
      setWallet(addr);
      fetchData(addr);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Connection failed");
    }
  };

  const handleRefresh = () => {
    if (!wallet) return;
    setRefreshing(true);
    fetchData(wallet);
  };

  const tokenizedStories = stories.filter((s) => s.status === "tokenized");
  const pendingStories = stories.filter((s) => s.status === "pending_eval");

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-full hover:bg-neutral-800 transition-colors text-neutral-400">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              {wallet && (
                <p className="text-xs text-neutral-500 font-mono">
                  {wallet.slice(0, 6)}…{wallet.slice(-6)}
                </p>
              )}
            </div>
          </div>
          {wallet && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-full hover:bg-neutral-800 transition-colors text-neutral-400"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>

        {/* Connect wallet prompt */}
        {!wallet && (
          <div className="text-center py-16 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center">
              <Wallet className="w-7 h-7 text-neutral-600" />
            </div>
            <div>
              <p className="font-semibold">Connect your wallet</p>
              <p className="text-sm text-neutral-500 mt-1">See your earnings, tokens, and story performance.</p>
            </div>
            <button
              onClick={handleConnect}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-semibold transition-colors"
            >
              Connect Phantom
            </button>
          </div>
        )}

        {loading && !data && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-900/20 border border-red-800 text-red-400 text-sm mb-6">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Staking nudge */}
            {data.stakedSkrBalance === 0 && (
              <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/10 border border-amber-500 mb-6">
                <div>
                  <p className="text-sm font-semibold text-amber-400">Stake SKR to vote</p>
                  <p className="text-xs text-neutral-400 mt-0.5">You need staked SKR to participate in weekly pools</p>
                </div>
                <a
                  href="https://seeker.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-semibold transition-colors flex-shrink-0"
                >
                  Stake →
                </a>
              </div>
            )}

            {/* Wallet stats */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              <StatCard
                label="SOL balance"
                value={`${data.solBalance.toFixed(4)} SOL`}
                icon={<Coins className="w-4 h-4" />}
              />
              <StatCard
                label="SKR balance"
                value={`${data.skrBalance.toLocaleString()} SKR`}
                sub="wallet (unstaked)"
                icon={<Coins className="w-4 h-4 text-amber-400" />}
              />
              <StatCard
                label="SKR staked"
                value={`${data.stakedSkrBalance.toLocaleString()} SKR`}
                sub={data.stakedSkrBalance > 0 ? "✓ voting eligible" : "stake to vote"}
                icon={<Coins className="w-4 h-4 text-green-400" />}
              />
              <StatCard
                label="Fee income (est.)"
                value={`${data.estimatedFeeIncomeSol.toFixed(4)} SOL`}
                sub="from recent txs"
                icon={<TrendingUp className="w-4 h-4 text-green-400" />}
              />
              <StatCard
                label="Tokens held"
                value={`${data.tokenCount}`}
                sub="SPL tokens"
                icon={<BarChart3 className="w-4 h-4 text-blue-400" />}
              />
            </div>

            {/* Story performance */}
            <div className="mb-8">
              <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-4">
                Your stories
              </h2>
              {stories.length === 0 ? (
                <p className="text-sm text-neutral-600">No stories yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {stories.map((story) => (
                    <div key={story.id} className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium">
                              {story.category}
                            </span>
                          </div>
                          <p className="font-medium text-sm truncate">{story.title}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {story.status === "tokenized" ? (
                            <span className="flex items-center gap-1 text-xs text-amber-400">
                              <CheckCircle className="w-3.5 h-3.5" /> Tokenized
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-neutral-500">
                              <Clock className="w-3.5 h-3.5" /> Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {story.status === "tokenized" && (
                        <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center justify-between">
                          <div className="text-xs text-neutral-500">
                            Author share: <span className="text-amber-400 font-semibold">80% of volume</span>
                          </div>
                          <a
                            href={`https://bags.fm/token/${story.id}?ref=sirhitalk`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors"
                          >
                            View on Bags <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Summary bar */}
            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-between text-sm mb-8">
              <div className="flex items-center gap-4">
                <span className="text-neutral-500">
                  <span className="text-white font-semibold">{tokenizedStories.length}</span> tokenized
                </span>
                <span className="text-neutral-500">
                  <span className="text-white font-semibold">{pendingStories.length}</span> in pool
                </span>
              </div>
              <Link href="/vote" className="text-amber-400 hover:text-amber-300 text-xs transition-colors">
                Weekly vote →
              </Link>
            </div>

            {/* Recent transactions */}
            <div>
              <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-4">
                Recent transactions
              </h2>
              {data.recentTxs.length === 0 ? (
                <p className="text-sm text-neutral-600">No transactions found.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.recentTxs.map((tx) => (
                    <a
                      key={tx.signature}
                      href={`https://solscan.io/tx/${tx.signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-600 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${tx.status === "success" ? "bg-green-500" : "bg-red-500"}`} />
                        <div>
                          <p className="text-sm font-mono text-neutral-300">{shortSig(tx.signature)}</p>
                          <p className="text-xs text-neutral-600">{timeAgo(tx.blockTime)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <span>{tx.fee.toFixed(5)} SOL fee</span>
                        <ExternalLink className="w-3 h-3" />
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
