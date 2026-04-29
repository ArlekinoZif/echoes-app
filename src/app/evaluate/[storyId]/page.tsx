"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { getStory, saveEvaluation } from "@/lib/store";
import { Story, EvaluationCriteria } from "@/lib/types";
import { Play, Pause, ArrowLeft } from "lucide-react";
import Link from "next/link";

const LISTEN_THRESHOLD = 0.8; // 80% before rating is unlocked

interface StarRatingProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function StarRating({ label, value, onChange, disabled }: StarRatingProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-neutral-400">{label}</span>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            disabled={disabled}
            onClick={() => onChange(star)}
            className={`w-10 h-10 rounded-xl text-lg transition-colors disabled:cursor-not-allowed ${
              star <= value
                ? "bg-amber-500 text-black"
                : "bg-neutral-800 text-neutral-600 hover:bg-neutral-700 disabled:hover:bg-neutral-800"
            }`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

export default function EvaluateStoryPage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = use(params);
  const router = useRouter();
  const [story, setStory] = useState<Story | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0-1
  const [listenedMax, setListenedMax] = useState(0); // highest fraction reached
  const [criteria, setCriteria] = useState<EvaluationCriteria>({
    audioQuality: 0,
    storytelling: 0,
    descriptionAccuracy: 0,
  });
  const [submitted, setSubmitted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const s = getStory(storyId);
    if (!s) { router.push("/evaluate"); return; }
    setStory(s);
    const audio = new Audio(s.audioBlobUrl);
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      const frac = audio.currentTime / (audio.duration || 1);
      setProgress(frac);
      setListenedMax((prev) => Math.max(prev, frac));
    };
    audio.onended = () => setIsPlaying(false);

    return () => { audio.pause(); };
  }, [storyId, router]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play(); setIsPlaying(true); }
  };

  const ratingUnlocked = listenedMax >= LISTEN_THRESHOLD;
  const canSubmit =
    ratingUnlocked &&
    criteria.audioQuality > 0 &&
    criteria.storytelling > 0 &&
    criteria.descriptionAccuracy > 0;

  const handleSubmit = () => {
    if (!canSubmit || !story) return;
    saveEvaluation({
      storyId: story.id,
      criteria,
      listenedPercent: Math.round(listenedMax * 100),
    });
    setSubmitted(true);
    setTimeout(() => router.push("/evaluate"), 1500);
  };

  if (!story) return null;

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const currentSec = Math.floor(progress * story.durationSeconds);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/evaluate"
            className="p-2 rounded-full hover:bg-neutral-800 transition-colors text-neutral-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="text-sm text-neutral-500">Back to list</span>
        </div>

        {/* Story info */}
        <div className="mb-6">
          <span className="text-xs text-amber-500 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full">
            {story.category}
          </span>
          <h1 className="text-2xl font-bold mt-3">{story.title}</h1>
          <p className="text-neutral-400 text-sm mt-2">{story.description}</p>
        </div>

        {/* Audio player */}
        <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 mb-8">
          {/* Progress track */}
          <div className="relative h-2 bg-neutral-800 rounded-full mb-4 overflow-hidden">
            {/* Listened threshold marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-500/50 z-10"
              style={{ left: `${LISTEN_THRESHOLD * 100}%` }}
            />
            {/* Playback progress */}
            <div
              className="h-full bg-neutral-500 rounded-full transition-all"
              style={{ width: `${progress * 100}%` }}
            />
            {/* Max listened */}
            <div
              className="absolute top-0 h-full bg-amber-500/30 rounded-full transition-all"
              style={{ width: `${listenedMax * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-600 mb-4">
            <span>{fmt(currentSec)}</span>
            <span>{fmt(story.durationSeconds)}</span>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={togglePlay}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-full font-semibold hover:bg-neutral-200 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isPlaying ? "Pause" : "Play"}
            </button>

            {!ratingUnlocked && (
              <span className="text-xs text-neutral-500">
                Listen to {Math.round(LISTEN_THRESHOLD * 100)}% to unlock rating
                <span className="text-amber-500 ml-1">
                  ({Math.round(listenedMax * 100)}%)
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Rating */}
        <div
          className={`flex flex-col gap-6 transition-opacity ${ratingUnlocked ? "opacity-100" : "opacity-30 pointer-events-none"}`}
        >
          <h2 className="font-semibold text-neutral-200">Rate this story</h2>

          <StarRating
            label="Audio quality"
            value={criteria.audioQuality}
            onChange={(v) => setCriteria((c) => ({ ...c, audioQuality: v }))}
            disabled={!ratingUnlocked}
          />
          <StarRating
            label="Storytelling"
            value={criteria.storytelling}
            onChange={(v) => setCriteria((c) => ({ ...c, storytelling: v }))}
            disabled={!ratingUnlocked}
          />
          <StarRating
            label="Description accuracy"
            value={criteria.descriptionAccuracy}
            onChange={(v) =>
              setCriteria((c) => ({ ...c, descriptionAccuracy: v }))
            }
            disabled={!ratingUnlocked}
          />

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitted}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black rounded-xl font-semibold transition-colors"
          >
            {submitted ? "Saved!" : "Submit evaluation"}
          </button>
        </div>
      </div>
    </div>
  );
}
