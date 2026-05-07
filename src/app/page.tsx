"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchPublicStories, fetchStoriesForSponsor, fetchFavourites, toggleFavouriteDb } from "@/lib/db";
import { useWallet } from "@/hooks/useWallet";
import { Story, StoryCategory } from "@/lib/types";
import { Heart, ExternalLink, Zap, Mic, Search, SlidersHorizontal, X } from "lucide-react";

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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

function StoryCard({
  story,
  wallet,
  canSponsor,
  isFav,
  onFavToggle,
}: {
  story: Story;
  wallet: string | null;
  canSponsor: boolean;
  isFav: boolean;
  onFavToggle: (id: string, wallet: string | null) => void;
}) {
  const [fav, setFav] = useState(isFav);

  async function handleFav(e: React.MouseEvent) {
    e.preventDefault();
    if (!wallet) return;
    const next = await toggleFavouriteDb(story.id, wallet);
    setFav(next);
    onFavToggle(story.id, wallet);
  }

  function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    const desc = story.description.length > 80
      ? story.description.slice(0, 77) + "…"
      : story.description;
    const link = story.tokenListingUrl ?? "https://echoes.fans";
    const text = `🎙️ "${story.title}" — a ${story.category} story on Echoes\n\n${desc}\n\nListen & trade: ${link}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div
      className="glass p-4 flex flex-col gap-3 transition-colors"
      style={{ borderRadius: "16px" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ color: "var(--text-2)", background: "rgba(0,0,0,0.06)" }}
            >
              {story.category}
            </span>
            <span className="text-xs" style={{ color: "var(--text-3)" }}>
              {fmt(story.durationSeconds)}
            </span>
            {story.status === "tokenized" && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: "linear-gradient(135deg, rgba(168,237,234,0.15), rgba(195,177,225,0.15))",
                  color: "#a8edea",
                  border: "1px solid rgba(168,237,234,0.2)",
                }}
              >
                ◆ tokenized
              </span>
            )}
          </div>
          <p className="font-semibold text-sm leading-snug" style={{ color: "var(--text-1)" }}>
            {story.title}
          </p>
          <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-3)" }}>
            {story.description}
          </p>
        </div>
        <button
          onClick={handleFav}
          className="p-1.5 rounded-full transition-colors flex-shrink-0"
          style={{ color: fav ? "#fed6e3" : "var(--text-3)" }}
        >
          <Heart className={`w-4 h-4 ${fav ? "fill-current" : ""}`} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {story.tokenListingUrl && (
          <a
            href={story.tokenListingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
          >
            <ExternalLink className="w-3 h-3" /> Trade on Bags
          </a>
        )}
        {canSponsor && (
          <Link
            href={`/tokenize/${story.id}?sponsor=1`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              background: "var(--surface-2)",
              color: "var(--text-2)",
              border: "1px solid var(--border)",
            }}
          >
            <Zap className="w-3 h-3" style={{ color: "var(--amber)" }} />
            Sponsor
          </Link>
        )}
        <button
          onClick={handleShare}
          className="ml-auto p-1.5 rounded-full transition-colors flex-shrink-0"
          title="Share on X"
          style={{ color: "var(--text-3)" }}
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const { address } = useWallet();
  const [stories, setStories] = useState<Story[]>([]);
  const [sponsorable, setSponsorable] = useState<Story[]>([]);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<StoryCategory | "All">("All");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  async function refresh(wallet: string | null) {
    const [pub, sponsor, favs] = await Promise.all([
      fetchPublicStories(),
      fetchStoriesForSponsor(wallet),
      wallet ? fetchFavourites(wallet) : Promise.resolve([] as string[]),
    ]);
    setStories(pub);
    setSponsorable(sponsor);
    setFavIds(new Set(favs));
  }

  useEffect(() => {
    refresh(address);
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = stories.filter((s) => {
    const matchCat = activeCategory === "All" || s.category === activeCategory;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen hero-bg" style={{ background: "var(--bg)" }}>
      <div className="max-w-xl mx-auto px-4 pt-10 pb-6 overflow-x-hidden">

        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-3xl font-bold tracking-tight glitch"
            style={{ letterSpacing: "-0.02em" }}
          >
            <span className="holo-text">echoes</span>
          </h1>
          <p className="text-xs mt-1 font-medium uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
            records library
          </p>
        </div>

        {/* Search + filter bar */}
        <div className="mb-4">
          <div className="flex gap-2 items-center">
            {/* Search input */}
            <div
              className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2.5 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.08)" }}
            >
              <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-3)" }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stories…"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "var(--text-1)" }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ color: "var(--text-3)" }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className="relative p-2.5 rounded-2xl flex-shrink-0 transition-colors"
              style={
                filtersOpen || activeCategory !== "All"
                  ? { background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }
                  : { background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.08)", color: "var(--text-2)" }
              }
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeCategory !== "All" && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                  style={{ background: "#ff6b9d" }}
                />
              )}
            </button>
          </div>

          {/* Collapsible category chips */}
          <div
            className="overflow-hidden transition-all"
            style={{
              maxHeight: filtersOpen ? "80px" : "0px",
              opacity: filtersOpen ? 1 : 0,
              marginTop: filtersOpen ? "10px" : "0px",
              transition: "max-height 0.25s ease, opacity 0.2s ease, margin-top 0.25s ease",
            }}
          >
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
              {(["All", ...CATEGORIES] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat as StoryCategory | "All");
                    setFiltersOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all"
                  style={
                    activeCategory === cat
                      ? { background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff", fontWeight: 600 }
                      : { background: "rgba(255,255,255,0.6)", color: "var(--text-3)", border: "1px solid rgba(0,0,0,0.08)" }
                  }
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stories feed */}
        {filtered.length > 0 ? (
          <div className="flex flex-col gap-2 mb-8">
            {filtered.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                wallet={address}
                canSponsor={
                  story.status === "listed" &&
                  !story.tokenMint &&
                  story.authorWallet !== address
                }
                isFav={favIds.has(story.id)}
                onFavToggle={(_, w) => refresh(w)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 flex flex-col items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
              }}
            >
              <Mic className="w-6 h-6" style={{ color: "var(--text-3)" }} />
            </div>
            <div>
              <p className="font-medium text-sm" style={{ color: "var(--text-2)" }}>
                {activeCategory === "All"
                  ? "No stories yet"
                  : `No ${activeCategory} stories yet`}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
                Be the first to record one
              </p>
            </div>
            <Link
              href="/record"
              className="mt-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
            >
              Record your story
            </Link>
          </div>
        )}

        {/* Sponsor section */}
        {sponsorable.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5" style={{ color: "var(--amber)" }} />
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
                Sponsor a story
              </h2>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--text-3)" }}>
              Sponsor the launch — earn 50% of all future trading fees.
            </p>
            <div className="flex flex-col gap-2">
              {sponsorable.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  wallet={address}
                  canSponsor={true}
                  isFav={favIds.has(story.id)}
                  onFavToggle={(_, w) => refresh(w)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
