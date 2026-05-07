"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchStoriesForEvaluation,
  fetchStoriesForSponsor,
  fetchMyEvaluatedIds,
  fetchMyStories,
  upsertStory,
} from "@/lib/db";
import { useWallet } from "@/hooks/useWallet";
import { Story } from "@/lib/types";
import { ArrowLeft, Mic, CheckCircle, Zap } from "lucide-react";

const REQUIRED = 3;

function fmt(s: number) {
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function EvaluatePage() {
  const { address } = useWallet();
  const [evalStories, setEvalStories] = useState<Story[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [sponsorable, setSponsorable] = useState<Story[]>([]);
  const [myPendingCount, setMyPendingCount] = useState(0);
  const [firstPendingId, setFirstPendingId] = useState<string | null>(null);

  async function refresh(wallet: string | null) {
    const [available, sponsorList, evalledIds, myStories] = await Promise.all([
      fetchStoriesForEvaluation(wallet),
      fetchStoriesForSponsor(wallet),
      wallet ? fetchMyEvaluatedIds(wallet) : Promise.resolve([] as string[]),
      wallet ? fetchMyStories(wallet) : Promise.resolve([] as Story[]),
    ]);

    setEvalStories(available);
    setCompletedIds(new Set(evalledIds));
    setSponsorable(sponsorList);

    const pending = myStories.filter((s) => s.status === "pending_eval");
    setMyPendingCount(pending.length);
    setFirstPendingId(pending[0]?.id ?? null);
  }

  useEffect(() => {
    refresh(address);
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  const evaluated = evalStories.filter((s) => completedIds.has(s.id)).length;
  const unlocked = evaluated >= REQUIRED;

  useEffect(() => {
    if (!unlocked || !address) return;
    fetchMyStories(address).then(async (mine) => {
      const pending = mine.filter((s) => s.status === "pending_eval");
      if (pending.length === 0) return;
      await Promise.all(pending.map((s) => upsertStory({ ...s, status: "listed" })));
      refresh(address);
    });
  }, [unlocked, address]); // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = REQUIRED - evaluated;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/"
            className="p-2 rounded-full transition-colors"
            style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.07)", color: "var(--text-2)" }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-1)" }}>Evaluate stories</h1>
            <p className="text-sm" style={{ color: "var(--text-3)" }}>
              {evaluated}/{REQUIRED} completed
            </p>
          </div>
        </div>

        {/* Pending notice */}
        {myPendingCount > 0 && (
          <div
            className="p-4 rounded-2xl mb-6"
            style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.3)" }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--amber)" }}>
              You have {myPendingCount} story{myPendingCount > 1 ? " stories" : ""} waiting to be listed.
            </p>
            <p className="text-xs mt-1" style={{ color: "rgba(245,158,11,0.7)" }}>
              Evaluate {remaining} more {remaining === 1 ? "story" : "stories"} to publish yours for free.
            </p>
          </div>
        )}

        {/* Progress bar */}
        <div
          className="h-1.5 rounded-full mb-6 overflow-hidden"
          style={{ background: "rgba(0,0,0,0.08)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(1, evaluated / REQUIRED) * 100}%`,
              background: "linear-gradient(90deg, #00c6be, #ff6b9d)",
            }}
          />
        </div>

        {/* Completed state */}
        {unlocked ? (
          <div className="text-center py-12 flex flex-col items-center gap-4 mb-8">
            <CheckCircle className="w-14 h-14" style={{ color: "var(--amber)" }} />
            <h2 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>Reviews done!</h2>
            <p className="text-sm" style={{ color: "var(--text-2)" }}>
              Your story has been listed and entered into the weekly ECHOES event.
            </p>
            <Link
              href="/"
              className="mt-2 px-6 py-3 rounded-full font-semibold transition-colors"
              style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
            >
              Back to Library
            </Link>
          </div>
        ) : evalStories.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center gap-4 mb-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.06)" }}
            >
              <Mic className="w-6 h-6" style={{ color: "var(--text-3)" }} />
            </div>
            <p className="text-sm" style={{ color: "var(--text-2)" }}>
              No stories available for evaluation yet.
            </p>
            <p className="text-xs" style={{ color: "var(--text-3)" }}>
              Check back soon — more stories are being submitted.
            </p>
            {myPendingCount > 0 && firstPendingId && (
              <Link
                href={`/list/${firstPendingId}`}
                className="mt-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ background: "rgba(0,0,0,0.06)", color: "var(--text-1)", border: "1px solid rgba(0,0,0,0.07)" }}
              >
                Pay $1 to list now →
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-8">
            <p className="text-sm mb-1" style={{ color: "var(--text-2)" }}>
              Evaluate {remaining} more {remaining === 1 ? "story" : "stories"} to list yours.
            </p>
            {evalStories.map((story) => {
              const done = completedIds.has(story.id);
              return (
                <Link
                  key={story.id}
                  href={done ? "#" : `/evaluate/${story.id}`}
                  className="p-5 rounded-2xl transition-colors"
                  style={
                    done
                      ? { border: "1px solid rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.04)", cursor: "default" }
                      : { border: "1px solid rgba(0,0,0,0.07)", background: "rgba(255,255,255,0.6)", cursor: "pointer" }
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ color: "var(--amber)", background: "rgba(245,158,11,0.1)" }}
                        >
                          {story.category}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-3)" }}>
                          {fmt(story.durationSeconds)}
                        </span>
                      </div>
                      <p className="font-semibold truncate" style={{ color: "var(--text-1)" }}>{story.title}</p>
                      <p className="text-sm mt-1 line-clamp-2" style={{ color: "var(--text-2)" }}>
                        {story.description}
                      </p>
                    </div>
                    {done ? (
                      <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--amber)" }} />
                    ) : (
                      <span
                        className="text-xs px-3 py-1 rounded-full flex-shrink-0"
                        style={{ background: "rgba(0,0,0,0.06)", color: "var(--text-2)" }}
                      >
                        Evaluate
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Sponsor section */}
        {sponsorable.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4" style={{ color: "var(--amber)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-2)" }}>
                Sponsor a story — earn 50% forever
              </h2>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--text-3)" }}>
              These listed stories aren&apos;t tokenized yet. Pay for the Bags launch and receive 50% of all trading fees — permanently.
            </p>
            <div className="flex flex-col gap-3">
              {sponsorable.map((story) => (
                <div key={story.id} className="glass p-5 rounded-2xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ color: "var(--amber)", background: "rgba(245,158,11,0.1)" }}
                        >
                          {story.category}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-3)" }}>
                          {fmt(story.durationSeconds)}
                        </span>
                      </div>
                      <p className="font-semibold truncate" style={{ color: "var(--text-1)" }}>{story.title}</p>
                      <p className="text-sm mt-1 line-clamp-2" style={{ color: "var(--text-2)" }}>
                        {story.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs" style={{ color: "var(--text-3)" }}>
                      Your share:{" "}
                      <span className="font-semibold" style={{ color: "#10b981" }}>50%</span>{" "}
                      of trading fees
                    </div>
                    <Link
                      href={`/tokenize/${story.id}?sponsor=1`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
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
