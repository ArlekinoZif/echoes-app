"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchPublicStories, fetchTopStories, fetchStoriesForSponsor,
  fetchFavourites, toggleFavouriteDb, upsertEvaluation,
} from "@/lib/db";
import { useIdentity } from "@/hooks/useIdentity";
import { Story, StoryCategory, Evaluation } from "@/lib/types";
import {
  Heart, ExternalLink, Zap, Mic, Play, Search,
  SlidersHorizontal, X, Lock, ChevronRight,
  MessageCircle, Flag, Pause,
} from "lucide-react";
import Image from "next/image";
import AudioPlayer from "@/components/AudioPlayer";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { storyPath, storyUrl } from "@/lib/story-url";

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const CATEGORIES: StoryCategory[] = [
  "War", "Love", "Immigration", "Entrepreneurship", "Family", "Survival", "Other",
];

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ── Review Form ────────────────────────────────────────────────────────────────

function ReviewForm({ story, wallet, onSubmit }: { story: Story; wallet: string; onSubmit: () => void }) {
  const [audioQuality, setAudioQuality] = useState(3);
  const [storytelling, setStorytelling] = useState(3);
  const [catOk, setCatOk] = useState(true);
  const [catSuggest, setCatSuggest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const evaluation: Evaluation = {
        storyId: story.id,
        criteria: { audioQuality, storytelling, descriptionAccuracy: catOk ? 5 : 2 },
        listenedPercent: 100,
      };
      await upsertEvaluation(evaluation, wallet);
      setDone(true);
      setTimeout(onSubmit, 800);
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  }

  if (done) return (
    <div className="py-3 text-center text-sm font-semibold" style={{ color: "var(--amber)" }}>✓ Review submitted!</div>
  );

  const Btn = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={active
        ? { background: "var(--amber)", color: "#0c0c0c" }
        : { background: "rgba(255,255,255,0.04)", color: "var(--text-3)", border: "1px solid rgba(255,255,255,0.06)" }
      }
    >{label}</button>
  );

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Voice Quality</span>
        </div>
        <div className="flex gap-1.5">
          {["Poor", "Avg", "Good", "Excellent"].map((l, i) => (
            <Btn key={l} label={l} active={audioQuality === i + 1} onClick={() => setAudioQuality(i + 1)} />
          ))}
        </div>
      </div>
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Story Content</span>
        </div>
        <div className="flex gap-1.5">
          {["Okay", "Good", "Interesting", "Captivating"].map((l, i) => (
            <Btn key={l} label={l} active={storytelling === i + 1} onClick={() => setStorytelling(i + 1)} />
          ))}
        </div>
      </div>
      <button
        onClick={() => setCatOk(v => !v)}
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm transition-all"
        style={catOk
          ? { background: "rgba(200,168,75,0.08)", border: "1.5px solid rgba(200,168,75,0.3)", color: "var(--text-1)" }
          : { background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.12)", color: "var(--text-1)" }
        }
      >
        <span className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: catOk ? "var(--amber)" : "rgba(255,255,255,0.06)", color: catOk ? "#0c0c0c" : "var(--text-3)" }}>
          {catOk ? "✓" : "×"}
        </span>
        Categories are suitable?
      </button>
      {!catOk && (
        <input type="text" value={catSuggest} onChange={e => setCatSuggest(e.target.value)}
          placeholder="Why incorrect? Suggest a better one…"
          className="w-full px-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-1)" }} />
      )}
      <button onClick={submit} disabled={submitting}
        className={submitting ? "w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity opacity-50" : "btn-gold w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"}>
        {submitting ? "Submitting…" : "Submit Review"}
      </button>
    </div>
  );
}

// ── Story Card ─────────────────────────────────────────────────────────────────

function StoryCard({ story, wallet, canSponsor, isFav, onFavToggle, showReviewButton, playMode = false }: {
  story: Story; wallet: string | null; canSponsor: boolean;
  isFav: boolean; onFavToggle: (id: string, wallet: string | null) => void;
  showReviewButton?: boolean;
  playMode?: boolean;
}) {
  const [fav, setFav] = useState(isFav);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  async function handleFav(e: React.MouseEvent) {
    e.stopPropagation();
    if (!wallet) return;
    const next = await toggleFavouriteDb(story.id, wallet);
    setFav(next);
    onFavToggle(story.id, wallet);
  }

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    // The recording's own page carries the Open Graph card, so shares land there
    // rather than on the bare domain.
    const link = storyUrl(story);
    const byLine = story.authorTwitter ? ` by @${story.authorTwitter}` : "";
    const text = `🎙️ "${story.title}"${byLine} — a ${story.category} story on Echoes\n\n${story.tokenListingUrl ? "Listen & trade" : "Listen"}: ${link}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  const authorLabel = story.authorTwitter
    ? `@${story.authorTwitter}`
    : story.authorWallet
    ? `${story.authorWallet.slice(0, 4)}…${story.authorWallet.slice(-4)}`
    : null;

  const meta = [story.category, authorLabel, fmt(story.durationSeconds)].filter(Boolean).join(" · ");

  return (
    <div className="glass overflow-hidden transition-all hover:border-white/[0.12]" style={{ borderRadius: "14px" }}>
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-3 py-3 cursor-pointer active:opacity-70 transition-opacity"
        onClick={() => { if (!story.isPrivate && story.audioBlobUrl) setPlayerOpen(o => !o); }}
      >
        {/* Thumbnail */}
        <div className="relative flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 44, height: 44 }}>
          {story.coverImageUrl ? (
            <Image src={story.coverImageUrl} alt="cover" fill sizes="44px" className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <Mic className="w-4 h-4" style={{ color: "var(--text-3)" }} />
            </div>
          )}
          {story.audioBlobUrl && !story.isPrivate && (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: playerOpen ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.3)" }}>
              {playerOpen
                ? <Pause className="w-3.5 h-3.5 text-white" />
                : <Play className="w-3.5 h-3.5 text-white" style={{ marginLeft: "1px" }} />
              }
            </div>
          )}
          {story.isPrivate && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
              <Lock className="w-3.5 h-3.5 text-white" />
            </div>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-1)" }}>{story.title}</p>
            {!playMode && story.status === "tokenized" && <span className="flex-shrink-0 text-xs" style={{ color: "var(--amber)" }}>◆</span>}
            {!playMode && story.isPrivate && story.priceSol && (
              <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded-md font-semibold"
                style={{ background: "rgba(200,168,75,0.15)", color: "var(--amber)" }}>
                {story.priceSol} SOL
              </span>
            )}
          </div>
          <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-3)" }}>{meta}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {!playMode && story.isPrivate && (
            <Link href={`/unlock/${story.id}`}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-1)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Lock className="w-3 h-3" /> Unlock
            </Link>
          )}
          {!playMode && story.tokenListingUrl && (
            <a href={story.tokenListingUrl} target="_blank" rel="noopener noreferrer"
              className="btn-gold flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold">
              <ExternalLink className="w-3 h-3" /> Trade
            </a>
          )}
          {!playMode && !story.tokenMint && story.ownerId === wallet && (
            <Link href={`/tokenize/${story.id}`}
              className="btn-gold flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold">
              <Zap className="w-3 h-3" /> Tokenize
            </Link>
          )}
          {!playMode && canSponsor && !story.tokenListingUrl && (
            <Link href={`/tokenize/${story.id}?sponsor=1`}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-2)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Zap className="w-3 h-3" /> Sponsor
            </Link>
          )}
          <button onClick={handleFav} style={{ color: fav ? "var(--amber)" : "var(--text-3)" }}>
            <Heart className={`w-4 h-4 ${fav ? "fill-current" : ""}`} />
          </button>
          <Link href={storyPath(story)} title="Open recording page" style={{ color: "var(--text-3)" }}>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button onClick={handleShare} style={{ color: "var(--text-3)" }}>
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Player */}
      {playerOpen && story.audioBlobUrl && !story.isPrivate && (
        <div className="px-3 pb-3">
          <AudioPlayer src={story.audioBlobUrl} durationSeconds={story.durationSeconds}
            title={story.title} artist={story.authorTwitter ?? story.category} artwork={story.coverImageUrl} />
          {!playMode && <div className="flex gap-2 mt-2">
            <button
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-3)" }}
              onClick={() => { setReviewOpen(o => !o); setReportOpen(false); }}
            >
              <MessageCircle className="w-3 h-3" /> {reviewOpen ? "Close" : "Review"}
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", color: reportOpen ? "var(--amber)" : "var(--text-3)" }}
              onClick={() => { setReportOpen(o => !o); setReviewOpen(false); }}
            >
              <Flag className="w-3 h-3" /> {reportOpen ? "Close" : "Report"}
            </button>
          </div>}
          {!playMode && reviewOpen && wallet && (
            <div className="mt-2 px-2 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <ReviewForm story={story} wallet={wallet} onSubmit={() => setReviewOpen(false)} />
            </div>
          )}
          {!playMode && reportOpen && (
            <div className="mt-2 px-2 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <ReportForm storyId={story.id} wallet={wallet} onDone={() => setReportOpen(false)} />
            </div>
          )}
          {!playMode && reviewOpen && !wallet && (
            <p className="text-xs mt-2 text-center" style={{ color: "var(--text-3)" }}>Connect wallet to submit review.</p>
          )}
        </div>
      )}

      {!playMode && showReviewButton && !playerOpen && wallet && story.ownerId !== wallet && (
        <div className="px-3 pb-3">
          <button
            onClick={() => { setPlayerOpen(true); setReviewOpen(true); }}
            className="w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1"
            style={{ background: "rgba(200,168,75,0.08)", color: "var(--amber)", border: "1px solid rgba(200,168,75,0.25)" }}
          >
            Listen to evaluate
          </button>
        </div>
      )}
    </div>
  );
}

// ── Legend Card ────────────────────────────────────────────────────────────────

function LegendCard({ story, playMode = false }: { story: Story; playMode?: boolean }) {
  const [playerOpen, setPlayerOpen] = useState(false);
  const authorLabel = story.authorTwitter
    ? `@${story.authorTwitter}`
    : story.authorWallet
    ? `${story.authorWallet.slice(0, 4)}…${story.authorWallet.slice(-4)}`
    : "Anonymous";

  return (
    <div
      className="flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02]"
      style={{
        width: "180px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
      }}
      onClick={() => setPlayerOpen(o => !o)}
    >
      <div className="relative" style={{ height: "90px" }}>
        {story.coverImageUrl ? (
          <Image src={story.coverImageUrl} alt="cover" fill sizes="180px" className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <Mic className="w-8 h-8" style={{ color: "var(--text-3)" }} />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <Play className="w-3.5 h-3.5 text-white" style={{ marginLeft: "1px" }} />
          </div>
        </div>
        {!playMode && story.status === "tokenized" && (
          <div className="btn-gold absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-md font-semibold">
            ◆
          </div>
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="text-xs font-semibold truncate" style={{ color: "var(--text-1)" }}>{story.title}</p>
        <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-3)" }}>{authorLabel}</p>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs" style={{ color: "var(--text-3)" }}>{story.category}</span>
          <span className="text-xs" style={{ color: "var(--text-3)" }}>{fmt(story.durationSeconds)}</span>
        </div>
      </div>
      {playerOpen && story.audioBlobUrl && (
        <div className="px-2.5 pb-2.5">
          <AudioPlayer src={story.audioBlobUrl} durationSeconds={story.durationSeconds}
            title={story.title} artist={story.authorTwitter ?? story.category} artwork={story.coverImageUrl} />
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const REPORT_REASONS: Array<{ value: string; label: string }> = [
  { value: "sexual_content", label: "Sexual content" },
  { value: "violence_or_hate", label: "Violence or hate" },
  { value: "illegal_activity", label: "Illegal activity" },
  { value: "harassment", label: "Harassment" },
  { value: "impersonation", label: "Impersonation" },
  { value: "spam_or_scam", label: "Spam or scam" },
  { value: "other", label: "Something else" },
];

/** Reporting path for user-generated stories, required by the store policy. */
function ReportForm({ storyId, wallet, onDone }: { storyId: string; wallet: string | null; onDone: () => void }) {
  const [reason, setReason] = useState(REPORT_REASONS[0].value);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  if (!wallet) {
    return <p className="text-xs text-center" style={{ color: "var(--text-3)" }}>Connect a wallet to report this recording.</p>;
  }
  if (state === "sent") {
    return <p className="text-xs text-center" style={{ color: "var(--amber)" }}>Thank you — this recording has been sent for review.</p>;
  }

  async function submit() {
    setState("sending");
    setError("");
    try {
      const res = await authenticatedFetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, reason, details: details.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not send the report");
      setState("sent");
      setTimeout(onDone, 2200);
    } catch (e: unknown) {
      setState("error");
      setError(e instanceof Error ? e.message : "Could not send the report");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs" style={{ color: "var(--text-2)" }}>Why are you reporting this recording?</p>
      <select
        value={reason}
        onChange={e => setReason(e.target.value)}
        className="px-2 py-1.5 rounded-lg text-xs outline-none"
        style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-1)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {REPORT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <textarea
        value={details}
        onChange={e => setDetails(e.target.value.slice(0, 1000))}
        placeholder="Anything else we should know? (optional)"
        rows={2}
        className="px-2 py-1.5 rounded-lg text-xs outline-none resize-none"
        style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-1)", border: "1px solid rgba(255,255,255,0.08)" }}
      />
      {state === "error" && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
      <button
        onClick={submit}
        disabled={state === "sending"}
        className="btn-gold py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Send report"}
      </button>
    </div>
  );
}

interface AuthorProfile {
  wallet: string;
  age?: number | null;
  country?: string | null;
  languages?: string | null;
}

export default function LibraryPage() {
  // `userId` (Solana address) is the identity used for ownership, favourites and reviews.
  const { userId } = useIdentity();
  const [stories, setStories] = useState<Story[]>([]);
  const [legends, setLegends] = useState<Story[]>([]);
  const [sponsorable, setSponsorable] = useState<Story[]>([]);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<StoryCategory | "All">("All");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  // Public demographics of the storytellers, used by the audience filters.
  const [authorProfiles, setAuthorProfiles] = useState<Record<string, AuthorProfile>>({});
  const [country, setCountry] = useState("");
  const [languages, setLanguages] = useState("");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");

  async function refresh(wallet: string | null) {
    setLoading(true);
    const [pub, top, sponsor, favs] = await Promise.all([
      fetchPublicStories(),
      fetchTopStories(),
      fetchStoriesForSponsor(wallet),
      wallet ? fetchFavourites(wallet) : Promise.resolve([] as string[]),
    ]);
    setStories(pub);
    setLegends(top);
    setSponsorable(sponsor);
    setFavIds(new Set(favs));
    setLoading(false);

    const owners = Array.from(new Set(pub.map(st => st.ownerId).filter(Boolean))) as string[];
    if (owners.length) {
      fetch(`/api/profiles?wallets=${encodeURIComponent(owners.join(","))}`)
        .then(r => r.json())
        .then((rows: AuthorProfile[]) => {
          if (!Array.isArray(rows)) return;
          const map: Record<string, AuthorProfile> = {};
          for (const row of rows) map[row.wallet] = row;
          setAuthorProfiles(map);
        })
        .catch(() => {});
    }
  }

  useEffect(() => { refresh(userId); }, [userId]);

  const audienceFilterOn = Boolean(country.trim() || languages.trim() || minAge || maxAge);

  const filtered = stories.filter(s => {
    const matchCat = activeCategory === "All" || s.category === activeCategory;
    const q = search.trim().toLowerCase();
    const matchText = !q || s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    if (!matchCat || !matchText) return false;
    if (!audienceFilterOn) return true;

    // An audience filter can only be satisfied by a storyteller we know about.
    const profile = s.ownerId ? authorProfiles[s.ownerId] : undefined;
    if (!profile) return false;

    const wantCountry = country.trim().toLowerCase();
    if (wantCountry && !(profile.country ?? "").toLowerCase().includes(wantCountry)) return false;
    const wantLanguages = languages.trim().toLowerCase();
    if (wantLanguages && !(profile.languages ?? "").toLowerCase().includes(wantLanguages)) return false;
    const age = profile.age ?? null;
    if (minAge && (age === null || age < Number(minAge))) return false;
    if (maxAge && (age === null || age > Number(maxAge))) return false;
    return true;
  });

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 pt-6 pb-6 lg:pt-8 lg:pb-8 overflow-x-hidden">

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight glitch" style={{ letterSpacing: "-0.03em" }}>
            <span className="holo-text">records library</span>
          </h1>
          <p className="text-xs mt-1 font-medium uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
            Stories from real people
          </p>
        </div>

        {/* Search + Filter */}
        <div className="mb-5">
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2.5 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-3)" }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search stories…"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "var(--text-1)" }} />
              {search && (
                <button onClick={() => setSearch("")} style={{ color: "var(--text-3)" }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => setFiltersOpen(o => !o)}
              className={`p-2.5 rounded-2xl flex-shrink-0 transition-colors relative ${filtersOpen || activeCategory !== "All" || audienceFilterOn ? "btn-gold" : ""}`}
              style={filtersOpen || activeCategory !== "All" || audienceFilterOn
                ? {}
                : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-2)" }
              }
            >
              <SlidersHorizontal className="w-4 h-4" />
              {(activeCategory !== "All" || audienceFilterOn) && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: "var(--amber)" }} />
              )}
            </button>
          </div>

          {filtersOpen && (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 mt-3">
              {(["All", ...CATEGORIES] as const).map(cat => (
                <button key={cat}
                  onClick={() => { setActiveCategory(cat as StoryCategory | "All"); setFiltersOpen(false); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all ${activeCategory === cat ? "btn-gold" : ""}`}
                  style={activeCategory !== cat ? { background: "rgba(255,255,255,0.04)", color: "var(--text-3)", border: "1px solid rgba(255,255,255,0.08)" } : {}}
                >{cat}</button>
              ))}
            </div>
          )}

          {filtersOpen && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input value={country} onChange={e => setCountry(e.target.value)} placeholder="Country"
                className="px-3 py-2 rounded-xl text-xs bg-transparent outline-none"
                style={{ border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-1)" }} />
              <input value={languages} onChange={e => setLanguages(e.target.value)} placeholder="Language"
                className="px-3 py-2 rounded-xl text-xs bg-transparent outline-none"
                style={{ border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-1)" }} />
              <input value={minAge} onChange={e => setMinAge(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Age from"
                className="px-3 py-2 rounded-xl text-xs bg-transparent outline-none"
                style={{ border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-1)" }} />
              <input value={maxAge} onChange={e => setMaxAge(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Age to"
                className="px-3 py-2 rounded-xl text-xs bg-transparent outline-none"
                style={{ border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-1)" }} />
              {audienceFilterOn && (
                <button
                  onClick={() => { setCountry(""); setLanguages(""); setMinAge(""); setMaxAge(""); }}
                  className="col-span-2 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-2)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Clear audience filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Featured Legends */}
        {legends.length > 0 && (
          <section className="mb-7">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold" style={{ color: "var(--text-1)" }}>⭐ Featured Legends</h2>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>Top rated storytellers</p>
              </div>
              <ChevronRight className="w-4 h-4" style={{ color: "var(--text-3)" }} />
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4">
              {legends.map(story => <LegendCard key={story.id} story={story} />)}
            </div>
          </section>
        )}

        {/* Recent Stories */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-3)" }}>
            Recent Stories
          </h2>

          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="flex flex-col gap-2 mb-8">
              {filtered.map(story => (
                <StoryCard
                  key={story.id} story={story} wallet={userId}
                  canSponsor={!story.tokenMint && story.ownerId !== userId}
                  isFav={favIds.has(story.id)}
                  onFavToggle={(_, w) => refresh(w)}
                  showReviewButton={story.status === "pending_eval"}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Mic className="w-6 h-6" style={{ color: "var(--text-3)" }} />
              </div>
              <div>
                <p className="font-medium text-sm" style={{ color: "var(--text-2)" }}>
                  {activeCategory === "All" ? "No stories yet" : `No ${activeCategory} stories yet`}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>Be the first to record one</p>
              </div>
              <Link href="/record"
                className="btn-gold mt-2 px-5 py-2.5 rounded-full text-sm font-semibold">
                Record your story
              </Link>
            </div>
          )}
        </section>

        {/* Sponsor section */}
        {sponsorable.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5" style={{ color: "var(--amber)" }} />
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-3)" }}>Sponsor a Story</h2>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--text-3)" }}>Sponsor the launch — earn 50% of all future trading fees.</p>
            <div className="flex flex-col gap-2">
              {sponsorable.map(story => (
                <StoryCard key={story.id} story={story} wallet={userId} canSponsor
                  isFav={favIds.has(story.id)} onFavToggle={(_, w) => refresh(w)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
