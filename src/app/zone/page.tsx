"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { useWallet } from "@/hooks/useWallet";
import { useConnectWallet } from "@privy-io/react-auth";
import { fetchMyStories, fetchFavourites, fetchPublicStories } from "@/lib/db";
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

export default function PatioPage() {
  const { authenticated, address, connect } = useWallet();
  const { connectWallet } = useConnectWallet();
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [echoesBalance, setEchoesBalance] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [myStories, setMyStories] = useState<Story[]>([]);
  const [tokenized, setTokenized] = useState<Story[]>([]);
  const [sponsored, setSponsored] = useState<Story[]>([]);
  const [favStories, setFavStories] = useState<Story[]>([]);

  async function loadData(addr: string | null) {
    if (!addr) return;
    const [mine, pub, favIds] = await Promise.all([
      fetchMyStories(addr),
      fetchPublicStories(),
      fetchFavourites(addr),
    ]);
    setMyStories(mine);
    setTokenized(mine.filter((s) => s.status === "tokenized" && s.tokenMint));
    setSponsored(pub.filter((s) => s.sponsorWallet === addr && s.tokenMint));
    const favSet = new Set(favIds);
    setFavStories(pub.filter((s) => favSet.has(s.id)));
  }

  const ECHOES_MINT = new PublicKey("8F2N1Da9z1arxiFKmTzxaKoX1yUjJ2xKFQBxxMjQBAGS");

  async function fetchBalance(addr: string) {
    const conn = new Connection(RPC_URL, "confirmed");
    const pk = new PublicKey(addr);

    // SOL balance
    try {
      const lamports = await conn.getBalance(pk);
      setSolBalance(lamports / 1e9);
    } catch { setSolBalance(null); }

    // ECHOES — detect which token program owns the mint, derive ATA, fetch balance
    try {
      const mintInfo = await conn.getAccountInfo(ECHOES_MINT);
      const tokenProgramId = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;
      const ata = getAssociatedTokenAddressSync(ECHOES_MINT, pk, false, tokenProgramId);
      const bal = await conn.getTokenAccountBalance(ata);
      setEchoesBalance(bal.value.uiAmount ?? 0);
    } catch {
      setEchoesBalance(0);
    }
  }

  useEffect(() => {
    if (address) {
      loadData(address);
      fetchBalance(address);
    }
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConnect() {
    setConnecting(true);
    try {
      await connect();
    } finally {
      setConnecting(false);
    }
  }

  async function handleCopy() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const statusBadge = (s: Story) => {
    if (s.status === "tokenized")
      return (
        <span className="flex items-center gap-1 text-xs" style={{ color: "#10b981" }}>
          <CheckCircle className="w-3 h-3" /> Tokenized
        </span>
      );
    if (s.status === "listed")
      return (
        <span className="flex items-center gap-1 text-xs" style={{ color: "#3b82f6" }}>
          <Zap className="w-3 h-3" /> Listed
        </span>
      );
    if (s.status === "pending_eval")
      return (
        <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-3)" }}>
          <Clock className="w-3 h-3" /> In evaluation
        </span>
      );
    return <span className="text-xs" style={{ color: "var(--text-3)" }}>Draft</span>;
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-xl mx-auto px-4 pt-10 pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.07)" }}
          >
            <User className="w-4 h-4" style={{ color: "var(--text-2)" }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>Patio</h1>
        </div>

        {/* Wallet card */}
        <div className="glass p-5 rounded-2xl mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4" style={{ color: "var(--amber)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-2)" }}>Wallet</span>
          </div>

          {address ? (
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm" style={{ color: "var(--text-1)" }}>{shortAddr(address)}</span>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded transition-colors"
                  style={{ color: "var(--text-3)" }}
                >
                  {copied ? (
                    <CheckCircle className="w-3.5 h-3.5" style={{ color: "#10b981" }} />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => connectWallet()}
                  className="ml-auto text-xs px-2.5 py-1 rounded-lg transition-colors"
                  style={{ background: "rgba(0,0,0,0.05)", color: "var(--text-3)", border: "1px solid rgba(0,0,0,0.07)" }}
                >
                  Change
                </button>
              </div>
              <div className="flex gap-4 mt-2">
                {solBalance !== null && (
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>
                    <span style={{ color: "var(--text-2)" }}>{solBalance.toFixed(4)}</span> SOL
                  </p>
                )}
                {echoesBalance !== null && (
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>
                    <span style={{ color: "var(--amber)" }}>{echoesBalance.toLocaleString()}</span> $ECHOES
                  </p>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
            >
              {connecting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Connecting…
                </span>
              ) : (
                "Connect wallet"
              )}
            </button>
          )}
        </div>

        {/* My Recordings */}
        <Section
          icon={<Mic className="w-4 h-4" style={{ color: "var(--amber)" }} />}
          title="My Recordings"
          count={myStories.length}
        >
          {myStories.length === 0 ? (
            <Empty text="No recordings yet.">
              <Link
                href="/record"
                className="text-xs underline"
                style={{ color: "var(--amber)" }}
              >
                Record your first story
              </Link>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {myStories.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.07)" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-1)" }}>{s.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs" style={{ color: "var(--text-3)" }}>{fmt(s.durationSeconds)}</span>
                      {statusBadge(s)}
                    </div>
                  </div>
                  {s.status === "draft" && (
                    <Link
                      href={`/list/${s.id}`}
                      className="flex-shrink-0 text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors"
                      style={{ background: "rgba(0,0,0,0.06)", color: "var(--text-2)" }}
                    >
                      Pay to list →
                    </Link>
                  )}
                  {s.status === "pending_eval" && (
                    <Link
                      href="/evaluate"
                      className="flex-shrink-0 text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors"
                      style={{ background: "rgba(0,0,0,0.06)", color: "var(--text-2)" }}
                    >
                      Evaluate →
                    </Link>
                  )}
                  {s.status === "listed" && !s.tokenMint && (
                    <Link
                      href={`/tokenize/${s.id}`}
                      className="flex-shrink-0 text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors"
                      style={{ background: "var(--amber)", color: "#000" }}
                    >
                      Tokenize
                    </Link>
                  )}
                  {s.tokenListingUrl && (
                    <a
                      href={s.tokenListingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 transition-colors"
                      style={{ color: "var(--text-3)" }}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Tokens Launched */}
        {tokenized.length > 0 && (
          <Section
            icon={<Coins className="w-4 h-4" style={{ color: "var(--amber)" }} />}
            title="Tokens I Launched"
            count={tokenized.length}
          >
            <ul className="flex flex-col gap-2">
              {tokenized.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.07)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold" style={{ color: "var(--amber)" }}>
                        ${s.ticker}
                      </span>
                      <span className="text-sm font-medium truncate" style={{ color: "var(--text-1)" }}>{s.title}</span>
                    </div>
                    <p className="text-xs font-mono mt-0.5 truncate" style={{ color: "var(--text-3)" }}>
                      {s.tokenMint}
                    </p>
                  </div>
                  {s.tokenListingUrl && (
                    <a
                      href={s.tokenListingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 flex items-center gap-1 text-xs font-medium transition-colors"
                      style={{ color: "var(--amber)" }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Bags
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Revenue Share */}
        {sponsored.length > 0 && (
          <Section
            icon={<TrendingUp className="w-4 h-4" style={{ color: "#10b981" }} />}
            title="Revenue Share"
            count={sponsored.length}
          >
            <p className="text-xs mb-3" style={{ color: "var(--text-3)" }}>
              Stories you sponsored. You earn 50% of trading fees — forever.
            </p>
            <ul className="flex flex-col gap-2">
              {sponsored.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.07)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {s.ticker && (
                        <span className="text-xs font-mono font-bold" style={{ color: "#10b981" }}>
                          ${s.ticker}
                        </span>
                      )}
                      <span className="text-sm font-medium truncate" style={{ color: "var(--text-1)" }}>{s.title}</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                      Sponsor share:{" "}
                      <span className="font-medium" style={{ color: "#10b981" }}>50%</span>
                    </p>
                  </div>
                  {s.tokenListingUrl && (
                    <a
                      href={s.tokenListingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 transition-colors"
                      style={{ color: "var(--text-3)" }}
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
            icon={<Heart className="w-4 h-4" style={{ color: "#f43f5e" }} />}
            title="Favourites"
            count={favStories.length}
          >
            <ul className="flex flex-col gap-2">
              {favStories.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.07)" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-1)" }}>{s.title}</p>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{ color: "var(--amber)", background: "rgba(245,158,11,0.1)" }}
                    >
                      {s.category}
                    </span>
                  </div>
                  {s.tokenListingUrl && (
                    <a
                      href={s.tokenListingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 transition-colors"
                      style={{ color: "var(--text-3)" }}
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
        <div className="mt-6 glass p-4 rounded-2xl">
          <p
            className="text-xs font-medium uppercase tracking-wider mb-3"
            style={{ color: "var(--text-3)" }}
          >
            Quick Links
          </p>
          <div className="flex flex-col gap-2">
            <a
              href="https://bags.fm/?ref=echoesfans"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between text-sm transition-colors"
              style={{ color: "var(--text-2)" }}
            >
              <span>Bags App</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://docs.echoes.fans"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between text-sm transition-colors"
              style={{ color: "var(--text-2)" }}
            >
              <span>Docs</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://linktr.ee/echoes_fans"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between text-sm transition-colors"
              style={{ color: "var(--text-2)" }}
            >
              <span>Links</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

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
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-2)" }}>{title}</h2>
        <span
          className="text-xs px-1.5 py-0.5 rounded-full"
          style={{ color: "var(--text-3)", background: "rgba(0,0,0,0.06)" }}
        >
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
    <div className="text-center py-6 text-sm" style={{ color: "var(--text-3)" }}>
      <p>{text}</p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
