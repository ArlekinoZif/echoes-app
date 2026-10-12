"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { useWallet } from "@/hooks/useWallet";
import { useIdentity } from "@/hooks/useIdentity";
import { fetchMyStories, fetchFavourites, fetchPublicStories } from "@/lib/db";
import { Story } from "@/lib/types";
import {
  Wallet, Mic, Heart, Coins, TrendingUp, ExternalLink,
  CheckCircle, Clock, Zap, Copy, Loader2, User, Mail,
  HelpCircle, Share2, Key, X as XClose, ChevronRight, Sliders,
} from "lucide-react";
import AudioPlayer from "@/components/AudioPlayer";
import { isSeekerShell, shareLink } from "@/lib/native-bridge";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import EchoSwap from "@/components/EchoSwap";

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

import { getRpcUrl } from "@/lib/rpcUrl";
const RPC_URL = getRpcUrl();

function fmt(s: number) { return `${Math.floor(s / 60)}m ${s % 60}s`; }
function shortAddr(addr: string) { return addr.slice(0, 6) + "…" + addr.slice(-4); }

// Dark row style
const ROW_STYLE = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" };

function SeekerPatioPage() {
  const { address, connect, switchWallet, provider } = useWallet();
  const { userId, email } = useIdentity();
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [echoesBalance, setEchoesBalance] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [instagramHandle, setInstagramHandle] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [handlesSaved, setHandlesSaved] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [referralSplit, setReferralSplit] = useState(0.5);
  const [refCopied, setRefCopied] = useState(false);
  // The referral code lives in the database — deriving one from the wallet
  // address locally produced links that never matched a stored code.
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const referralLink = referralCode ? `https://echoes.fans?ref=${referralCode}` : "";

  useEffect(() => {
    if (!address) {
      setReferralCode(null);
      setReferralCount(0);
      return;
    }
    let cancelled = false;
    authenticatedFetch(`/api/referral?wallet=${encodeURIComponent(address)}`)
      .then((res: Response) => (res.ok ? res.json() : null))
      .then((data: { code?: string; count?: number; referralSplit?: number } | null) => {
        if (cancelled || !data) return;
        if (data.code) setReferralCode(data.code);
        setReferralCount(data.count ?? 0);
        if (typeof data.referralSplit === "number") setReferralSplit(data.referralSplit);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [address]);

  // Erasure of the account and its data, required by the store publisher policy.
  async function deleteAccount() {
    setDeleteState("working");
    setDeleteError("");
    try {
      const res = await authenticatedFetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not erase the account");
      // The account is gone; drop every cached view of it.
      router.replace("/");
      router.refresh();
    } catch (e: unknown) {
      setDeleteState("error");
      setDeleteError(e instanceof Error ? e.message : "Could not erase the account");
    }
  }

  // In the Seeker shell this opens the Android share sheet; elsewhere it copies.
  async function shareReferral() {
    if (!referralLink) return;
    const shared = await shareLink({
      title: "Echoes",
      text: "Record your story on Echoes.",
      url: referralLink,
    });
    if (!shared || isSeekerShell()) return;
    setRefCopied(true);
    setTimeout(() => setRefCopied(false), 1800);
  }
  const router = useRouter();
  const [keysOpen, setKeysOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteState, setDeleteState] = useState<"idle" | "working" | "error">("idle");
  const [deleteError, setDeleteError] = useState("");
  const [keyCopied, setKeyCopied] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);

  const [myStories, setMyStories] = useState<Story[]>([]);
  const [tokenized, setTokenized] = useState<Story[]>([]);
  const [sponsored, setSponsored] = useState<Story[]>([]);
  const [favStories, setFavStories] = useState<Story[]>([]);

  const ECHOES_MINT = new PublicKey("8F2N1Da9z1arxiFKmTzxaKoX1yUjJ2xKFQBxxMjQBAGS");

  async function loadData(id: string | null) {
    if (!id) return;
    const [mine, pub, favIds] = await Promise.all([fetchMyStories(id), fetchPublicStories(), fetchFavourites(id)]);
    setMyStories(mine);
    setTokenized(mine.filter((s) => s.status === "tokenized" && s.tokenMint));
    // Sponsored = stories this user paid to launch — keyed by the on-chain wallet.
    setSponsored(address ? pub.filter((s) => s.sponsorWallet === address && s.tokenMint) : []);
    const favSet = new Set(favIds);
    setFavStories(pub.filter((s) => favSet.has(s.id)));
  }

  async function fetchBalance(addr: string) {
    const conn = new Connection(RPC_URL, "confirmed");
    const pk = new PublicKey(addr);
    try { setSolBalance((await conn.getBalance(pk)) / 1e9); } catch { setSolBalance(null); }
    try {
      const mintInfo = await conn.getAccountInfo(ECHOES_MINT);
      const tokenProgramId = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
      const ata = getAssociatedTokenAddressSync(ECHOES_MINT, pk, false, tokenProgramId);
      setEchoesBalance((await conn.getTokenAccountBalance(ata)).value.uiAmount ?? 0);
    } catch { setEchoesBalance(0); }
  }

  // Wallet addresses are the canonical identity for recordings and favourites.
  useEffect(() => { loadData(userId); }, [userId, address]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wallet-only data (SOL/$ECHO balance, social handles) needs an address.
  useEffect(() => {
    if (address) {
      fetchBalance(address);
      setInstagramHandle(localStorage.getItem(`ig_${address}`) ?? "");
      setTiktokHandle(localStorage.getItem(`tt_${address}`) ?? "");
    }
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  function saveHandles() {
    if (!address) return;
    localStorage.setItem(`ig_${address}`, instagramHandle.replace(/^@/, "").trim());
    localStorage.setItem(`tt_${address}`, tiktokHandle.replace(/^@/, "").trim());
    setHandlesSaved(true);
    setTimeout(() => setHandlesSaved(false), 2000);
  }

  async function handleConnect() {
    setConnecting(true);
    try { await connect(); } finally { setConnecting(false); }
  }

  async function handleCopy() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const statusBadge = (s: Story) => {
    if (s.status === "tokenized") return <span className="flex items-center gap-1 text-xs" style={{ color: "#10b981" }}><CheckCircle className="w-3 h-3" /> Tokenized</span>;
    if (s.status === "listed") return <span className="flex items-center gap-1 text-xs" style={{ color: "#3b82f6" }}><Zap className="w-3 h-3" /> Listed</span>;
    if (s.status === "pending_eval") return <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-3)" }}><Clock className="w-3 h-3" /> In evaluation</span>;
    return <span className="text-xs" style={{ color: "var(--text-3)" }}>Draft</span>;
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 pt-8 pb-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <User className="w-4 h-4" style={{ color: "var(--text-2)" }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>Patio</h1>
        </div>

        {/* Profile card */}
        <div className="glass p-5 rounded-2xl mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-3)" }}>Profile</p>
          <div className="flex flex-col gap-3">

            {/* Wallet */}
            <div className="flex items-center gap-3 p-3 rounded-xl" style={ROW_STYLE}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(245,200,66,0.08)" }}>
                <Wallet className="w-4 h-4" style={{ color: "var(--amber)" }} />
              </div>
              <div className="flex-1 min-w-0">
                {address ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-medium" style={{ color: "var(--text-1)" }}>{shortAddr(address)}</span>
                      <button onClick={handleCopy} className="p-0.5 rounded" style={{ color: "var(--text-3)" }}>
                        {copied ? <CheckCircle className="w-3 h-3" style={{ color: "#10b981" }} /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {solBalance !== null && (
                        <span className="text-xs" style={{ color: "var(--text-3)" }}>
                          <span style={{ color: "var(--text-2)" }}>{solBalance.toFixed(3)}</span> SOL
                        </span>
                      )}
                      {echoesBalance !== null && (
                        <span className="text-xs" style={{ color: "var(--text-3)" }}>
                          <span style={{ color: "var(--amber)" }}>{echoesBalance.toLocaleString()}</span> $ECHO
                        </span>
                      )}
                      <button onClick={() => setSwapOpen(true)}
                        className="text-xs px-2 py-0.5 rounded-md font-semibold transition-all active:scale-95"
                        style={{ background: "rgba(200,168,75,0.08)", border: "1px solid rgba(200,168,75,0.2)", color: "#c8a84b" }}>
                        + Buy
                      </button>
                    </div>
                  </>
                ) : <span className="text-sm" style={{ color: "var(--text-3)" }}>No wallet connected</span>}
              </div>
              {address ? (
                <button onClick={() => void switchWallet()}
                  className="text-xs px-2.5 py-1.5 rounded-lg font-medium flex-shrink-0 transition-opacity hover:opacity-80"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-2)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  Change
                </button>
              ) : (
                <button onClick={handleConnect} disabled={connecting}
                  className="btn-gold text-xs px-2.5 py-1.5 rounded-lg font-semibold flex-shrink-0 transition-opacity hover:opacity-80 disabled:opacity-50">
                  {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Connect"}
                </button>
              )}
            </div>

            {email && (
              <AccountRow icon={<Mail className="w-4 h-4" style={{ color: "#6366f1" }} />} iconBg="rgba(99,102,241,0.1)"
                label={email} connected />
            )}

            <AccountRow icon={<Wallet className="w-4 h-4" style={{ color: "#c8a84b" }} />} iconBg="rgba(200,168,75,0.08)"
              label={provider === "helius" ? "Helius embedded wallet" : "Seed Vault / external wallet"}
              connected={!!address} />

            {/* Instagram */}
            <div className="flex items-center gap-3 p-3 rounded-xl" style={ROW_STYLE}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(214,36,159,0.08)" }}>
                <InstagramIcon className="w-4 h-4" />
              </div>
              <input type="text" value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="Instagram @handle" className="flex-1 text-sm bg-transparent outline-none min-w-0"
                style={{ color: "var(--text-1)" }} />
            </div>

            {/* TikTok */}
            <div className="flex items-center gap-3 p-3 rounded-xl" style={ROW_STYLE}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.04)" }}>
                <TikTokIcon className="w-4 h-4" />
              </div>
              <input type="text" value={tiktokHandle} onChange={(e) => setTiktokHandle(e.target.value)}
                placeholder="TikTok @handle" className="flex-1 text-sm bg-transparent outline-none min-w-0"
                style={{ color: "var(--text-1)" }} />
            </div>

            <button onClick={saveHandles} className="w-full py-2 rounded-xl text-sm font-semibold transition-colors"
              style={handlesSaved
                ? { background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }
                : { background: "rgba(255,255,255,0.04)", color: "var(--text-2)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {handlesSaved ? "✓ Saved" : "Save Instagram & TikTok"}
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <button onClick={() => setHowItWorksOpen(true)}
            className="flex items-center gap-2 p-3 rounded-xl text-left transition-all hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(99,102,241,0.1)" }}>
              <HelpCircle className="w-4 h-4" style={{ color: "#6366f1" }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>How it works?</span>
          </button>

          <button onClick={shareReferral}
            className="flex items-center gap-2 p-3 rounded-xl text-left transition-all hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,168,75,0.1)" }}>
              <Share2 className="w-4 h-4" style={{ color: "var(--amber)" }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: refCopied ? "var(--amber)" : "var(--text-2)" }}>
              {refCopied ? "Link copied!" : referralCount > 0 ? `Referrals · ${referralCount}` : "Referral system"}
            </span>
          </button>

          <Link href="/profile/edit"
            className="flex items-center gap-2 p-3 rounded-xl transition-all hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
              <Sliders className="w-4 h-4" style={{ color: "var(--text-2)" }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>Edit profile</span>
          </Link>

          <button onClick={() => setKeysOpen(true)}
            className="flex items-center gap-2 p-3 rounded-xl text-left transition-all hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,200,66,0.08)" }}>
              <Key className="w-4 h-4" style={{ color: "var(--amber)" }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>Export Keys</span>
          </button>
        </div>

        {/* Referral detail */}
        {address && (
          <div className="glass p-4 rounded-2xl mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-3)" }}>Referral System</p>
            <p className="text-xs mb-3" style={{ color: "var(--text-2)" }}>
              You earn <span className="font-bold" style={{ color: "var(--amber)" }}>20%</span> of platform fees from users you invite.
            </p>
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--text-3)" }}>
                <span>Kickback to referee</span>
                <span className="font-semibold" style={{ color: "var(--text-2)" }}>
                  {referralSplit === 0 ? "You keep all" : referralSplit === 1 ? "50/50 split" : `${Math.round(referralSplit * 50)}% kickback`}
                </span>
              </div>
              <input type="range" min={0} max={1} step={0.1} value={referralSplit}
                onChange={(e) => setReferralSplit(Number(e.target.value))}
                className="w-full" style={{ accentColor: "#c8a84b" }} />
              <div className="flex justify-between text-xs mt-1" style={{ color: "var(--text-3)" }}>
                <span>You keep all</span><span>Split 50/50</span>
              </div>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--text-3)" }}>
              Inactivity rule: fees redistribute if you don&apos;t visit for 7 days or record for 30 days.
            </p>
            <button onClick={shareReferral}
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              style={{ background: refCopied ? "rgba(200,168,75,0.14)" : "rgba(200,168,75,0.06)", border: "1.5px solid rgba(200,168,75,0.3)", color: "var(--amber)" }}>
              <Copy className="w-3.5 h-3.5" />
              {refCopied
                ? "Copied!"
                : referralCode
                  ? `Tap to copy — echoes.fans?ref=${referralCode}`
                  : "Connect a wallet to get your referral link"}
            </button>
          </div>
        )}

        {/* How it works popup */}
        {howItWorksOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-5"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
            <div className="w-full max-w-sm rounded-3xl flex flex-col gap-4"
              style={{ background: "rgba(18,18,18,0.97)", padding: "20px 20px 24px", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 48px rgba(0,0,0,0.5)" }}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold" style={{ color: "var(--text-1)" }}>How it works</h2>
                <button onClick={() => setHowItWorksOpen(false)}><XClose className="w-5 h-5" style={{ color: "var(--text-3)" }} /></button>
              </div>
              <div className="flex flex-col gap-3 text-sm" style={{ color: "var(--text-2)" }}>
                <div className="flex gap-3"><span className="text-lg">🎙️</span><div><strong style={{ color: "var(--text-1)" }}>Record</strong> — Speak your story (max 5 min).</div></div>
                <div className="flex gap-3"><span className="text-lg">📋</span><div><strong style={{ color: "var(--text-1)" }}>Publish</strong> — Pay 2400 $ECHOES or review 3 stories free.</div></div>
                <div className="flex gap-3"><span className="text-lg">⚡</span><div><strong style={{ color: "var(--text-1)" }}>Tokenize</strong> — Launch your story token on Bags. 0.75% of every trade.</div></div>
                <div className="flex gap-3"><span className="text-lg">💸</span><div><strong style={{ color: "var(--text-1)" }}>Earn</strong> — Author 55%, ECHO protocol 25%, sponsor 20%.</div></div>
              </div>
              <a href="https://docs.echoes.fans" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-2)", border: "1px solid rgba(255,255,255,0.08)" }}>
                Read full docs <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}

        {/* Account erasure */}
        <div className="glass mt-4 p-4 rounded-2xl flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>Delete account</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
              Erases your profile, activity and recordings. This cannot be undone.
            </p>
          </div>
          <button
            onClick={() => { setDeleteOpen(true); setDeleteConfirm(""); setDeleteState("idle"); }}
            className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}
          >
            Delete
          </button>
        </div>

        {deleteOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-5"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
            <div className="w-full max-w-sm rounded-3xl flex flex-col gap-3"
              style={{ background: "rgba(18,18,18,0.97)", padding: "20px 20px 24px", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold" style={{ color: "var(--text-1)" }}>Delete account</h2>
                <button onClick={() => setDeleteOpen(false)}><XClose className="w-5 h-5" style={{ color: "var(--text-3)" }} /></button>
              </div>
              <p className="text-xs" style={{ color: "var(--text-2)" }}>
                This erases your profile, favourites, evaluations, reports and unlock records, and
                deletes the recordings you own. A recording that was already tokenised stays on-chain;
                its personal details are stripped instead. Blockchain transactions cannot be removed.
              </p>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>Type DELETE to confirm.</p>
              <input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="px-3 py-2 rounded-xl text-sm bg-transparent outline-none"
                style={{ border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-1)" }}
              />
              {deleteState === "error" && <p className="text-xs" style={{ color: "#f87171" }}>{deleteError}</p>}
              <button
                onClick={deleteAccount}
                disabled={deleteConfirm !== "DELETE" || deleteState === "working"}
                className="w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
              >
                {deleteState === "working" ? "Erasing…" : "Erase my account"}
              </button>
            </div>
          </div>
        )}

        {/* Export Keys popup */}
        {keysOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-5"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
            <div className="w-full max-w-sm rounded-3xl flex flex-col gap-4"
              style={{ background: "rgba(18,18,18,0.97)", padding: "20px 20px 24px", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 48px rgba(0,0,0,0.5)" }}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold" style={{ color: "var(--text-1)" }}>Export Keys</h2>
                <button onClick={() => setKeysOpen(false)}><XClose className="w-5 h-5" style={{ color: "var(--text-3)" }} /></button>
              </div>
              <div className="p-3 rounded-xl text-xs" style={{ background: "rgba(245,200,66,0.06)", border: "1px solid rgba(245,200,66,0.2)", color: "rgba(245,200,66,0.8)" }}>
                ⚠️ Your private key gives full access to your wallet. Never share it. Store it safely offline.
              </div>
              <div>
                <p className="text-xs mb-2" style={{ color: "var(--text-3)" }}>Wallet address (public)</p>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={ROW_STYLE}>
                  <span className="flex-1 font-mono text-xs truncate" style={{ color: "var(--text-1)" }}>{address ?? "—"}</span>
                  <button onClick={() => { if (address) { navigator.clipboard.writeText(address); setKeyCopied(true); setTimeout(() => setKeyCopied(false), 1500); } }}
                    style={{ color: keyCopied ? "#10b981" : "var(--text-3)" }}>
                    {keyCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>
                Key export and recovery are handled by your connected wallet. Echoes never stores your private key.
              </p>
              <button onClick={() => setKeysOpen(false)} className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-2)", border: "1px solid rgba(255,255,255,0.08)" }}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* My Recordings */}
        <Section icon={<Mic className="w-4 h-4" style={{ color: "var(--amber)" }} />} title="My Recordings" count={myStories.length}>
          {myStories.length === 0 ? (
            <Empty text="No recordings yet.">
              <Link href="/record" className="text-xs underline" style={{ color: "var(--amber)" }}>Record your first story</Link>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {myStories.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 p-3 rounded-xl" style={ROW_STYLE}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-1)" }}>{s.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: "var(--text-3)" }}>{fmt(s.durationSeconds)}</span>
                        {statusBadge(s)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {s.status === "draft" && <Link href={`/list/${s.id}`} className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-2)", border: "1px solid rgba(255,255,255,0.08)" }}>Pay to list →</Link>}
                      {s.status === "pending_eval" && <Link href="/evaluate" className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-2)", border: "1px solid rgba(255,255,255,0.08)" }}>Evaluate →</Link>}
                      {s.status === "listed" && !s.tokenMint && (
                        <Link href={`/tokenize/${s.id}`} className="btn-gold text-xs px-2.5 py-1 rounded-lg font-semibold">Tokenize</Link>
                      )}
                      {s.tokenListingUrl && <a href={s.tokenListingUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-3)" }}><ExternalLink className="w-4 h-4" /></a>}
                    </div>
                  </div>
                  {s.audioBlobUrl && <AudioPlayer src={s.audioBlobUrl} durationSeconds={s.durationSeconds}
                    title={s.title} artist={s.authorTwitter ?? s.category} artwork={s.coverImageUrl} />}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Tokens Launched */}
        {tokenized.length > 0 && (
          <Section icon={<Coins className="w-4 h-4" style={{ color: "var(--amber)" }} />} title="Tokens I Launched" count={tokenized.length}>
            <ul className="flex flex-col gap-2">
              {tokenized.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-xl" style={ROW_STYLE}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold" style={{ color: "var(--amber)" }}>${s.ticker}</span>
                      <span className="text-sm font-medium truncate" style={{ color: "var(--text-1)" }}>{s.title}</span>
                    </div>
                    <p className="text-xs font-mono mt-0.5 truncate" style={{ color: "var(--text-3)" }}>{s.tokenMint}</p>
                  </div>
                  {s.tokenListingUrl && (
                    <a href={s.tokenListingUrl} target="_blank" rel="noopener noreferrer"
                      className="flex-shrink-0 flex items-center gap-1 text-xs font-medium" style={{ color: "var(--amber)" }}>
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
          <Section icon={<TrendingUp className="w-4 h-4" style={{ color: "#10b981" }} />} title="Revenue Share" count={sponsored.length}>
            <p className="text-xs mb-3" style={{ color: "var(--text-3)" }}>Stories you sponsored. You earn 50% of trading fees — forever.</p>
            <ul className="flex flex-col gap-2">
              {sponsored.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-xl" style={ROW_STYLE}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {s.ticker && <span className="text-xs font-mono font-bold" style={{ color: "#10b981" }}>${s.ticker}</span>}
                      <span className="text-sm font-medium truncate" style={{ color: "var(--text-1)" }}>{s.title}</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>Sponsor share: <span className="font-medium" style={{ color: "#10b981" }}>50%</span></p>
                  </div>
                  {s.tokenListingUrl && <a href={s.tokenListingUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-3)" }}><ExternalLink className="w-4 h-4" /></a>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Favourites */}
        {favStories.length > 0 && (
          <Section icon={<Heart className="w-4 h-4" style={{ color: "#f43f5e" }} />} title="Favourites" count={favStories.length}>
            <ul className="flex flex-col gap-2">
              {favStories.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 p-3 rounded-xl" style={ROW_STYLE}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-1)" }}>{s.title}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ color: "var(--amber)", background: "rgba(245,200,66,0.1)" }}>{s.category}</span>
                    </div>
                    {s.tokenListingUrl && <a href={s.tokenListingUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-3)" }}><ExternalLink className="w-4 h-4" /></a>}
                  </div>
                  {s.audioBlobUrl && <AudioPlayer src={s.audioBlobUrl} durationSeconds={s.durationSeconds}
                    title={s.title} artist={s.authorTwitter ?? s.category} artwork={s.coverImageUrl} />}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {swapOpen && <EchoSwap onClose={() => setSwapOpen(false)} />}

        {/* Quick links */}
        <div className="mt-6 glass p-4 rounded-2xl">
          <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-3)" }}>Quick Links</p>
          <div className="flex flex-col gap-2">
            {[
              { href: "https://bags.fm/?ref=echoesfans", label: "Bags App" },
              { href: "https://docs.echoes.fans", label: "Docs" },
              { href: "https://linktr.ee/echoes_fans", label: "Links" },
            ].map(({ href, label }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between text-sm transition-colors hover:opacity-80"
                style={{ color: "var(--text-2)" }}>
                <span>{label}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PatioPage() {
  return <SeekerPatioPage />;
}

function AccountRow({ icon, iconBg, label, sublabel, connected, onConnect, loading }: {
  icon: React.ReactNode; iconBg: string; label: string; sublabel?: string;
  connected: boolean; onConnect?: () => void; loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl" style={ROW_STYLE}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: connected ? "var(--text-1)" : "var(--text-3)" }}>{label}</p>
        {sublabel && <p className="text-xs truncate" style={{ color: "var(--text-3)" }}>{sublabel}</p>}
      </div>
      {connected ? (
        <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full flex-shrink-0"
          style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
          <CheckCircle className="w-3 h-3" /> Connected
        </span>
      ) : onConnect ? (
        <button onClick={onConnect} disabled={loading}
          className="btn-gold text-xs px-2.5 py-1.5 rounded-lg font-semibold flex-shrink-0 transition-opacity hover:opacity-80 disabled:opacity-50">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Connect"}
        </button>
      ) : null}
    </div>
  );
}

function Section({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-2)" }}>{title}</h2>
        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ color: "var(--text-3)", background: "rgba(255,255,255,0.06)" }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="text-center py-6 text-sm" style={{ color: "var(--text-3)" }}>
      <p>{text}</p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
