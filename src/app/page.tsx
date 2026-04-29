"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStories } from "@/lib/store";
import { Story } from "@/lib/types";
import { Mic, Clock, CheckCircle, Radio, Trophy, BarChart3 } from "lucide-react";

export default function Home() {
  const [stories, setStories] = useState<Story[]>([]);

  useEffect(() => {
    setStories(getStories().sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  const statusIcon = (status: Story["status"]) => {
    if (status === "tokenized") return <CheckCircle className="w-4 h-4 text-amber-400" />;
    if (status === "pending_eval") return <Clock className="w-4 h-4 text-neutral-500" />;
    return <Radio className="w-4 h-4 text-neutral-600" />;
  };

  const statusLabel = (status: Story["status"]) => {
    if (status === "tokenized") return "Tokenized";
    if (status === "pending_eval") return "In evaluation pool";
    return "Draft";
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Logo */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
              <Mic className="w-5 h-5 text-black" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Echoes</span>
          </div>
          <p className="text-neutral-500 text-sm">
            Preserve human experiences on-chain. Record → tokenize forever on
            Arweave → trade on Bags.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3 mb-10">
          <Link
            href="/record"
            className="flex items-center justify-center gap-2 w-full py-4 bg-amber-500 hover:bg-amber-400 text-black rounded-2xl font-semibold text-lg transition-colors"
          >
            <Mic className="w-5 h-5" />
            Record your story
          </Link>
          <Link
            href="/vote"
            className="flex items-center justify-center gap-2 w-full py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white rounded-2xl font-semibold transition-colors"
          >
            <Trophy className="w-5 h-5 text-amber-400" />
            Weekly SKR vote pool
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 w-full py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white rounded-2xl font-semibold transition-colors"
          >
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Author dashboard
          </Link>
        </div>

        {/* Stories list */}
        {stories.length > 0 ? (
          <div>
            <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-4">
              Your stories
            </h2>
            <div className="flex flex-col gap-3">
              {stories.map((story) => (
                <div
                  key={story.id}
                  className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-amber-500 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full">
                          {story.category}
                        </span>
                        <span className="text-xs text-neutral-600">
                          {fmt(story.durationSeconds)}
                        </span>
                      </div>
                      <p className="font-semibold truncate">{story.title}</p>
                      <p className="text-sm text-neutral-500 mt-1 line-clamp-2">
                        {story.description}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {statusIcon(story.status)}
                      <span className="text-xs text-neutral-600">
                        {statusLabel(story.status)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-neutral-600">
            <Mic className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No stories yet. Record your first one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
