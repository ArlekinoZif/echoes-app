"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getStoriesForEvaluation,
  getStoriesForSponsor,
  getEvaluations,
  getStories,
} from "@/lib/store";
import { getConnectedWallet } from "@/lib/wallet";
import { Story } from "@/lib/types";
import { ArrowLeft, Mic, CheckCircle, Zap } from "lucide-react";

const REQUIRED = 3;

function fmt(s: number) {
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function EvaluatePage() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [evalStories, setEvalStories] = useState<Story[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [sponsorable, setSponsorable] = useState<Story[]>([]);
  const [myPendingCount, setMyPendingCount] = useState(0);

  function refresh() {
    const w = getConnectedWallet();
    setWallet(w);

    const available = getStoriesForEvaluation();
    setEvalStories(available);

    const done = new Set(getEvaluations().map((e) => e.storyId));
    setCompletedIds(done);

    setSponsorable(getStoriesForSponsor(w));

    // How many of MY stories are waiting for evaluation
    const myPending = getStories().filter(
      (s) => s.status === "pending_eval"
    ).length;
    setMyPendingCount(myPending);
  }

  useEffect(() => {
    refresh();
  }, []);

  const evaluated = evalStories.filter((s) => completedIds.has(s.id)).length;
  const remaining = REQUIRED - evaluated;
  const unlocked = evaluated >= REQUIRED;

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/"
            className="p-2 rounded-full hover:bg-neutral-800 transition-colors text-neutral-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Evaluate stories</h1>
            <p className="text-sm text-neutral-500">
              {evaluated}/{REQUIRED} completed
            </p>
          </div>
        </div>

        {/* ── Section 1: Evaluate to list your story ──────────────────── */}
        {myPendingCount > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/50 mb-6">
            <p className="text-sm text-amber-300 font-medium">
              You have {myPendingCount} story{myPendingCount > 1 ? " stories" : ""} waiting to be listed.
            </p>
            <p className="text-xs text-amber-400/70 mt-1">
              Evaluate {remaining} more{" "}
              {remaining === 1 ? "story" : "stories"} to publish yours for free.
            </p>
          </div>
        )}

        {/* Progress bar */}
        <div className="h-1.5 bg-neutral-800 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all rounded-full"
            style={{ width: `${Math.min(1, evaluated / REQUIRED) * 100}%` }}
          />
        </div>

        {/* Completed state */}
        {unlocked ? (
          <div className="text-center py-12 flex flex-col items-center gap-4 mb-8">
            <CheckCircle className="w-14 h-14 text-amber-500" />
            <h2 className="text-xl font-bold">Reviews done!</h2>
            <p className="text-neutral-400 text-sm">
              Your story has been listed and entered into the weekly ECHOES event.
            </p>
            <Link
              href="/"
              className="mt-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-full font-semibold transition-colors"
            >
              Back to Library
            </Link>
          </div>
        ) : evalStories.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center gap-4 mb-8">
            <Mic className="w-12 h-12 text-neutral-700" />
            <p className="text-neutral-400 text-sm">
              No stories available for evaluation yet.
            </p>
            <p className="text-xs text-neutral-600">
              Check back soon — more stories are being submitted.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-8">
            <p className="text-sm text-neutral-400 mb-1">
              Evaluate {remaining} more{" "}
              {remaining === 1 ? "story" : "stories"} to list yours.
            </p>
            {evalStories.map((story) => {
              const done = completedIds.has(story.id);
              return (
                <Link
                  key={story.id}
                  href={done ? "#" : `/evaluate/${story.id}`}
                  className={`p-5 rounded-2xl border transition-colors ${
                    done
                      ? "border-amber-800 bg-amber-500/5 cursor-default"
                      : "border-neutral-800 bg-neutral-900 hover:border-neutral-600 cursor-pointer"
                  }`}
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
                    {done ? (
                      <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <span className="text-xs text-neutral-500 bg-neutral-800 px-3 py-1 rounded-full flex-shrink-0">
                        Evaluate
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ── Section 2: Sponsor & Tokenize ───────────────────────────── */}
        {sponsorable.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-neutral-300">
                Sponsor a story — earn 50% forever
              </h2>
            </div>
            <p className="text-xs text-neutral-600 mb-4">
              These listed stories aren&apos;t tokenized yet. Pay for Arweave storage
              + Bags launch and receive 50% of all trading volume — permanently.
            </p>
            <div className="flex flex-col gap-3">
              {sponsorable.map((story) => (
                <div
                  key={story.id}
                  className="p-5 rounded-2xl border border-neutral-800 bg-neutral-900"
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
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-neutral-600">
                      Your share:{" "}
                      <span className="text-emerald-400 font-semibold">50%</span>{" "}
                      of trading volume
                    </div>
                    <Link
                      href={`/tokenize/${story.id}?sponsor=1`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Zap className="w-3 h-3" /> Sponsor &amp; tokenize
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
