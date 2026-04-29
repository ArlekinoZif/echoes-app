"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStoriesForEvaluation, getEvaluations } from "@/lib/store";
import { Story } from "@/lib/types";
import { ArrowLeft, Mic, CheckCircle } from "lucide-react";

const REQUIRED = 3;

export default function EvaluatePage() {
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const available = getStoriesForEvaluation();
    setStories(available);
    const done = new Set(getEvaluations().map((e) => e.storyId));
    setCompletedIds(done);
  }, []);

  const evaluated = stories.filter((s) => completedIds.has(s.id)).length;
  const remaining = REQUIRED - evaluated;

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-xl mx-auto px-4 py-10">
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

        {/* Progress bar */}
        <div className="h-1.5 bg-neutral-800 rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all rounded-full"
            style={{ width: `${(evaluated / REQUIRED) * 100}%` }}
          />
        </div>

        {evaluated >= REQUIRED ? (
          <div className="text-center py-16 flex flex-col items-center gap-4">
            <CheckCircle className="w-16 h-16 text-amber-500" />
            <h2 className="text-xl font-bold">All done!</h2>
            <p className="text-neutral-400 text-sm">
              Your story has been submitted to the weekly SKR vote pool.
            </p>
            <Link
              href="/"
              className="mt-4 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-full font-semibold transition-colors"
            >
              Back to home
            </Link>
          </div>
        ) : stories.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-4">
            <Mic className="w-12 h-12 text-neutral-700" />
            <p className="text-neutral-400">
              No stories available for evaluation yet.
            </p>
            <p className="text-xs text-neutral-600">
              Check back soon — more stories are being submitted.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-neutral-400 mb-2">
              Evaluate {remaining} more{" "}
              {remaining === 1 ? "story" : "stories"} to publish yours.
            </p>
            {stories.map((story) => {
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
                          {Math.floor(story.durationSeconds / 60)}m{" "}
                          {story.durationSeconds % 60}s
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
      </div>
    </div>
  );
}
