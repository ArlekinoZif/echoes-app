"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Connection } from "@solana/web3.js";
import { connectWallet, getConnectedWallet } from "@/lib/wallet";
import { getStories, getFavourites, getStory } from "@/lib/store";
import { Story } from "@/lib/types";
import {
  Wallet, Mic, Heart, Coins, TrendingUp, ExternalLink,
  CheckCircle, Clock, Zap, Copy, Loader2, User,
} from "lucide-react";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

function fmt(s: number) {
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function shortAddr(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function ZonePage() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [myStories, setMyStories] = useState<Story[]>([]);
  const [tokenized, setTokenized] = useState<Story[]>([]);
  const [sponsored, setSponsored] = useState<Story[]>([]);
  const [favStories, setFavStories] = useState<Story[]>([]);

  function loadData(addr: string | null) {
    const all = getStories();
    setMyStories(all.sort((a, b) => b.createdAt - a.createdAt));
    setTokenized(all.filter((s) => s.status === "tokenized" && s.tokenMint));
    setSponsored(
      addr
        ? all.filter((s) => s.sponsorWallet === addr && s.tokenMint)
        : []
    );
    const favIds = getFavourites();
    setFavStories(favIds.map((id) => getStory(id)).filter(Boolean) as Story[]);
  }

  async function fetchBalance(addr: string) {
    try {
      const conn = new Connection(RPC_URL, "confirmed");
      const lamports = await conn.getBalance(
        { toBase58: () => addr } as Parameters<typeof conn.getBalance>[0]
      );
      setSolBalance(lamports / 1e9);
    } catch {
      setSolBalance(null);
    }
  }

  useEffect(() => {
    const addr = getConnectedWallet();
    setWallet(addr);
    loadData(addr);
    if (addr) fetchBalance(addr);
  }, []);

  async function handleConnect() {
    setConnecting(true);
    try {
      const addr = await connectWallet();
      setWallet(addr);
      loadData(addr);
      await fetchBalance(addr);
    } finally {
      setConnecting(false);
    }
  }

  async function handleCopy() {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const statusBadge = (s: Story) => {
    if (s.status === "tokenized")
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-400">
          <CheckCircle className="w-3 h-3" /> Tokenized
        </span>
      );
    if (s.status === "listed")
      return (
        <span className="flex items-center gap-1 text-xs text-blue-400">
          <Zap className="w-3 h-3" /> Listed
        </span>
      );
    if (s.status === "pending_eval")
      return (
        <span className="flex items-center gap-1 text-xs text-neutral-500">
          <Clock className="w-3 h-3" /> In evaluation
        </span>
      );
    return (
      <span className="text-xs text-neutral-600">Draft</span>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-xl mx-auto px-4 pt-10 pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-xl bg-neutral-800 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-neutral-300" />
          </div>
          <h1 className="text-xl font-bold">Personal Zone</h1>
        </div>

        {/* Wallet card */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-neutral-300">Wallet</span>
          </div>

          {wallet ? (
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-white">{shortAddr(wallet)}</span>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-neutral-800 transition-colors text-neutral-500 hover:text-neutral-300"
                >
                  {copied ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              {solBalance !== null && (
                <p className="text-sm text-neutral-500 mt-1">
                  {solBalance.toFixed(4)} SOL
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black rounded-xl font-semibold text-sm transition-colors"
            >
              {connecting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Connecting…
                </span>
              ) : (
                "Connect Phantom"
              )}
            </button>
          )}
        </div>

        {/* My Recordings */}
        <Section
          icon={<Mic className="w-4 h-4 text-amber-400" />}
          title="My Recordings"
          count={myStories.length}
        >
          {myStories.length === 0 ? (
            <Empty text="No recordings yet.">
              <Link
                href="/record"
                className="text-xs text-amber-400 hover:text-amber-300 underline"
              >
                Record your first story
              </Link>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {myStories.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-xl bg-neutral-900/50 border border-neutral-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{s.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-neutral-600">{fmt(s.durationSeconds)}</span>
                      {statusBadge(s)}
                    </div>
                  </div>
                  {s.status === "listed" && !s.tokenMint && (
                    <Link
                      href={`/tokenize/${s.id}`}
                      className="flex-shrink-0 text-xs px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-semibold transition-colors"
                    >
                      Tokenize
                    </Link>
                  )}
                  {s.tokenListingUrl && (
                    <a
                      href={s.tokenListingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Tokens Owned */}
        {tokenized.length > 0 && (
          <Section
            icon={<Coins className="w-4 h-4 text-amber-400" />}
            title="Tokens I Launched"
            count={tokenized.length}
          >
            <ul className="flex flex-col gap-2">
              {tokenized.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-neutral-900/50 border border-neutral-800"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-amber-400">
                        ${s.ticker}
                      </span>
                      <span className="text-sm font-medium truncate">{s.title}</span>
                    </div>
                    <p className="text-xs text-neutral-600 font-mono mt-0.5 truncate">
                      {s.tokenMint}
                    </p>
                  </div>
                  {s.tokenListingUrl && (
                    <a
                      href={s.tokenListingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Bags
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Revenue Share (sponsored stories) */}
        {sponsored.length > 0 && (
          <Section
            icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
            title="Revenue Share"
            count={sponsored.length}
          >
            <p className="text-xs text-neutral-600 mb-3">
              Stories you sponsored. You earn 50% of trading volume — forever.
            </p>
            <ul className="flex flex-col gap-2">
              {sponsored.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-neutral-900/50 border border-neutral-800"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {s.ticker && (
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          ${s.ticker}
                        </span>
                      )}
                      <span className="text-sm font-medium truncate">{s.title}</span>
                    </div>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      Sponsor share:{" "}
                      <span className="text-emerald-400 font-medium">50%</span>
                    </p>
                  </div>
                  {s.tokenListingUrl && (
                    <a
                      href={s.tokenListingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Favourites */}
        {favStories.length > 0 && (
          <Section
            icon={<Heart className="w-4 h-4 text-red-400" />}
            title="Favourites"
            count={favStories.length}
          >
            <ul className="flex flex-col gap-2">
              {favStories.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-neutral-900/50 border border-neutral-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{s.title}</p>
                    <span className="text-xs text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                      {s.category}
                    </span>
                  </div>
                  {s.tokenListingUrl && (
                    <a
                      href={s.tokenListingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Quick links */}
        <div className="mt-6 p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
            Quick Links
          </p>
          <div className="flex flex-col gap-2">
            <a
              href="https://bags.fm"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between text-sm text-neutral-400 hover:text-white transition-colors"
            >
              <span>Bags App</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <Link href="/vote" className="flex items-center justify-between text-sm text-neutral-400 hover:text-white transition-colors">
              <span>Weekly ECHOES event</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <a
              href="https://arweave.net"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between text-sm text-neutral-400 hover:text-white transition-colors"
            >
              <span>Arweave explorer</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-sm font-semibold text-neutral-300">{title}</h2>
        <span className="text-xs text-neutral-600 bg-neutral-800 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

function Empty({
  text,
  children,
}: {
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="text-center py-6 text-neutral-600 text-sm">
      <p>{text}</p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
