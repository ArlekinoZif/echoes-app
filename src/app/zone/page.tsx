"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { useWallet } from "@/hooks/useWallet";
import { useConnectWallet, usePrivy, useLinkAccount } from "@privy-io/react-auth";
import { fetchMyStories, fetchFavourites, fetchPublicStories } from "@/lib/db";
import { Story } from "@/lib/types";
import {
  Wallet, Mic, Heart, Coins, TrendingUp, ExternalLink,
  CheckCircle, Clock, Zap, Copy, Loader2, User, Mail,
} from "lucide-react";

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#fd5949"/>
          <stop offset="50%" stopColor="#d6249f"/>
          <stop offset="100%" stopColor="#285AEB"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="url(#ig-grad)" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4" stroke="url(#ig-grad)" strokeWidth="2"/>
      <circle cx="17.5" cy="6.5" r="1" fill="#d6249f"/>
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
    </svg>
  );
}

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
  const { user } = usePrivy();
  const { linkTwitter, linkInstagram, linkTiktok } = useLinkAccount();
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [echoesBalance, setEchoesBalance] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  const accounts = user?.linkedAccounts ?? [];
  const emailAccount = accounts.find((a) => a.type === "email") as { type: "email"; address: string } | undefined;
  const googleAccount = accounts.find((a) => a.type === "google_oauth") as { type: "google_oauth"; email: string; name: string | null } | undefined;
  const twitterAccount = accounts.find((a) => a.type === "twitter_oauth") as { type: "twitter_oauth"; username: string | null; name: string | null } | undefined;
  const instagramAccount = accounts.find((a) => a.type === "instagram_oauth") as { type: "instagram_oauth"; username: string | null } | undefined;
  const tiktokAccount = accounts.find((a) => a.type === "tiktok_oauth") as { type: "tiktok_oauth"; username: string | null; name: string | null } | undefined;

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

  async function handleLink(provider: string) {
    setLinking(provider);
    try {
      if (provider === "twitter") await linkTwitter();
      else if (provider === "instagram") await linkInstagram();
      else if (provider === "tiktok") await linkTiktok();
    } finally {
      setLinking(null);
    }
  }

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

        {/* Profile card */}
        <div className="glass p-5 rounded-2xl mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-3)" }}>
            Profile
          </p>

          <div className="flex flex-col gap-3">

            {/* Wallet row */}
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.06)" }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(245,158,11,0.1)" }}
              >
                <Wallet className="w-4 h-4" style={{ color: "var(--amber)" }} />
              </div>
              <div className="flex-1 min-w-0">
                {address ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-medium" style={{ color: "var(--text-1)" }}>
                        {shortAddr(address)}
                      </span>
                      <button onClick={handleCopy} className="p-0.5 rounded" style={{ color: "var(--text-3)" }}>
                        {copied ? <CheckCircle className="w-3 h-3" style={{ color: "#10b981" }} /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="flex gap-3 mt-0.5">
                      {solBalance !== null && (
                        <span className="text-xs" style={{ color: "var(--text-3)" }}>
                          <span style={{ color: "var(--text-2)" }}>{solBalance.toFixed(3)}</span> SOL
                        </span>
                      )}
                      {echoesBalance !== null && (
                        <span className="text-xs" style={{ color: "var(--text-3)" }}>
                          <span style={{ color: "var(--amber)" }}>{echoesBalance.toLocaleString()}</span> $ECHOES
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <span className="text-sm" style={{ color: "var(--text-3)" }}>No wallet connected</span>
                )}
              </div>
              {address ? (
                <button
                  onClick={() => connectWallet()}
                  className="text-xs px-2.5 py-1.5 rounded-lg font-medium flex-shrink-0 transition-opacity hover:opacity-80"
                  style={{ background: "rgba(0,0,0,0.06)", color: "var(--text-2)" }}
                >
                  Change
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="text-xs px-2.5 py-1.5 rounded-lg font-semibold flex-shrink-0 transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
                >
                  {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Connect"}
                </button>
              )}
            </div>

            {/* Email row */}
            {emailAccount && (
              <AccountRow
                icon={<Mail className="w-4 h-4" style={{ color: "#6366f1" }} />}
                iconBg="rgba(99,102,241,0.1)"
                label={emailAccount.address}
                connected
              />
            )}

            {/* Google row */}
            {googleAccount && (
              <AccountRow
                icon={<GoogleIcon className="w-4 h-4" />}
                iconBg="rgba(66,133,244,0.08)"
                label={googleAccount.name ?? googleAccount.email}
                sublabel={googleAccount.name ? googleAccount.email : undefined}
                connected
              />
            )}

            {/* Twitter / X */}
            <AccountRow
              icon={<XIcon className="w-4 h-4" />}
              iconBg="rgba(0,0,0,0.06)"
              label={twitterAccount ? `@${twitterAccount.username ?? twitterAccount.name}` : "Twitter / X"}
              connected={!!twitterAccount}
              onConnect={() => handleLink("twitter")}
              loading={linking === "twitter"}
            />

            {/* Instagram */}
            <AccountRow
              icon={<InstagramIcon className="w-4 h-4" />}
              iconBg="rgba(214,36,159,0.08)"
              label={instagramAccount ? `@${instagramAccount.username}` : "Instagram"}
              connected={!!instagramAccount}
              onConnect={() => handleLink("instagram")}
              loading={linking === "instagram"}
            />

            {/* TikTok */}
            <AccountRow
              icon={<TikTokIcon className="w-4 h-4" />}
              iconBg="rgba(0,0,0,0.06)"
              label={tiktokAccount ? `@${tiktokAccount.username ?? tiktokAccount.name}` : "TikTok"}
              connected={!!tiktokAccount}
              onConnect={() => handleLink("tiktok")}
              loading={linking === "tiktok"}
            />

          </div>
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
                      style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
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

function AccountRow({
  icon,
  iconBg,
  label,
  sublabel,
  connected,
  onConnect,
  loading,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  sublabel?: string;
  connected: boolean;
  onConnect?: () => void;
  loading?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.06)" }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: connected ? "var(--text-1)" : "var(--text-3)" }}
        >
          {label}
        </p>
        {sublabel && (
          <p className="text-xs truncate" style={{ color: "var(--text-3)" }}>{sublabel}</p>
        )}
      </div>
      {connected ? (
        <span
          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full flex-shrink-0"
          style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}
        >
          <CheckCircle className="w-3 h-3" /> Connected
        </span>
      ) : onConnect ? (
        <button
          onClick={onConnect}
          disabled={loading}
          className="text-xs px-2.5 py-1.5 rounded-lg font-semibold flex-shrink-0 transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Connect"}
        </button>
      ) : null}
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
