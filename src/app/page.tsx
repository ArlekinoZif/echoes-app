"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPublicStories, getStoriesForSponsor, toggleFavourite, isFavourite } from "@/lib/store";
import { getConnectedWallet } from "@/lib/wallet";
import { Story, StoryCategory } from "@/lib/types";
import {
  Mic, CheckCircle, Heart, ExternalLink, Zap, BookOpen, Clock,
} from "lucide-react";

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
  onFavToggle,
}: {
  story: Story;
  wallet: string | null;
  canSponsor: boolean;
  onFavToggle: (id: string) => void;
}) {
  const [fav, setFav] = useState(() => isFavourite(story.id));

  function handleFav(e: React.MouseEvent) {
    e.preventDefault();
    const next = toggleFavourite(story.id);
    setFav(next);
    onFavToggle(story.id);
  }

  return (
    <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col gap-3">
      {/* Meta row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs text-amber-500 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full">
              {story.category}
            </span>
            <span className="text-xs text-neutral-600">{fmt(story.durationSeconds)}</span>
            {story.status === "tokenized" && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <CheckCircle className="w-3 h-3" /> Tokenized
              </span>
            )}
            {story.status === "listed" && (
              <span className="flex items-center gap-1 text-xs text-blue-400 font-medium">
                <Clock className="w-3 h-3" /> Listed
              </span>
            )}
          </div>
          <p className="font-semibold truncate">{story.title}</p>
          <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{story.description}</p>
        </div>
        <button
          onClick={handleFav}
          className="p-1.5 rounded-full hover:bg-neutral-800 transition-colors flex-shrink-0"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${fav ? "fill-amber-400 text-amber-400" : "text-neutral-600"}`}
          />
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {story.tokenListingUrl && (
          <a
            href={story.tokenListingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded-lg text-xs font-semibold transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> Trade on Bags
          </a>
        )}
        {canSponsor && (
          <Link
            href={`/tokenize/${story.id}?sponsor=1`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold transition-colors border border-neutral-700"
          >
            <Zap className="w-3 h-3 text-amber-400" /> Sponsor &amp; tokenize
          </Link>
        )}
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [sponsorable, setSponsorable] = useState<Story[]>([]);
  const [activeCategory, setActiveCategory] = useState<StoryCategory | "All">("All");

  function refresh() {
    const w = getConnectedWallet();
    setWallet(w);
    setStories(getPublicStories());
    setSponsorable(getStoriesForSponsor(w));
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered =
    activeCategory === "All"
      ? stories
      : stories.filter((s) => s.category === activeCategory);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-xl mx-auto px-4 pt-10 pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Records Library</h1>
            <p className="text-xs text-neutral-500">Public stories from the community</p>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
          {(["All", ...CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat as StoryCategory | "All")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                activeCategory === cat
                  ? "bg-amber-500 text-black"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Stories feed */}
        {filtered.length > 0 ? (
          <div className="flex flex-col gap-3 mb-8">
            {filtered.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                wallet={wallet}
                canSponsor={
                  story.status === "listed" &&
                  !story.tokenMint &&
                  story.authorWallet !== wallet
                }
                onFavToggle={refresh}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-neutral-600">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {activeCategory === "All"
                ? "No public stories yet. Be the first to record one!"
                : `No ${activeCategory} stories yet.`}
            </p>
          </div>
        )}

        {/* Sponsor section */}
        {sponsorable.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-neutral-300">
                Sponsor a story — earn 50% of trading volume
              </h2>
            </div>
            <p className="text-xs text-neutral-600 mb-4">
              These stories are listed but not yet tokenized. Pay for the Bags
              launch &amp; Arweave storage — you earn 50% of all future trading
              fees, the author earns 25%, and the platform 25%.
            </p>
            <div className="flex flex-col gap-3">
              {sponsorable.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  wallet={wallet}
                  canSponsor={true}
                  onFavToggle={refresh}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state CTA */}
        {stories.length === 0 && sponsorable.length === 0 && (
          <div className="text-center pt-4">
            <Link
              href="/record"
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-2xl font-semibold transition-colors"
            >
              <Mic className="w-4 h-4" /> Record your story
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
