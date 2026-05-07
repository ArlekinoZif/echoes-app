"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { fetchStory, upsertEvaluation } from "@/lib/db";
import { useWallet } from "@/hooks/useWallet";
import { Story, EvaluationCriteria } from "@/lib/types";
import { Play, Pause, ArrowLeft } from "lucide-react";
import Link from "next/link";

const LISTEN_THRESHOLD = 0.8;

interface StarRatingProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function StarRating({ label, value, onChange, disabled }: StarRatingProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm" style={{ color: "var(--text-2)" }}>{label}</span>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            disabled={disabled}
            onClick={() => onChange(star)}
            className="w-10 h-10 rounded-xl text-lg transition-colors disabled:cursor-not-allowed"
            style={
              star <= value
                ? { background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }
                : { background: "rgba(0,0,0,0.06)", color: "var(--text-3)" }
            }
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
  const { address } = useWallet();
  const [story, setStory] = useState<Story | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [listenedMax, setListenedMax] = useState(0);
  const [criteria, setCriteria] = useState<EvaluationCriteria>({
    audioQuality: 0,
    storytelling: 0,
    descriptionAccuracy: 0,
  });
  const [submitted, setSubmitted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let audio: HTMLAudioElement | null = null;
    fetchStory(storyId).then((s) => {
      if (!s) { router.push("/evaluate"); return; }
      setStory(s);
      audio = new Audio(s.audioBlobUrl);
      audioRef.current = audio;
      audio.ontimeupdate = () => {
        const frac = audio!.currentTime / (audio!.duration || 1);
        setProgress(frac);
        setListenedMax((prev) => Math.max(prev, frac));
      };
      audio.onended = () => setIsPlaying(false);
    });
    return () => { audio?.pause(); };
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

  const handleSubmit = async () => {
    if (!canSubmit || !story) return;
    const wallet = address ?? "anonymous";
    await upsertEvaluation(
      { storyId: story.id, criteria, listenedPercent: Math.round(listenedMax * 100) },
      wallet
    );
    setSubmitted(true);
    setTimeout(() => router.push("/evaluate"), 1500);
  };

  if (!story) return null;

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const currentSec = Math.floor(progress * story.durationSeconds);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/evaluate"
            className="p-2 rounded-full transition-colors"
            style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.07)", color: "var(--text-2)" }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="text-sm" style={{ color: "var(--text-3)" }}>Back to list</span>
        </div>

        {/* Story info */}
        <div className="mb-6">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ color: "var(--amber)", background: "rgba(245,158,11,0.1)" }}
          >
            {story.category}
          </span>
          <h1 className="text-2xl font-bold mt-3" style={{ color: "var(--text-1)" }}>{story.title}</h1>
          <p className="text-sm mt-2" style={{ color: "var(--text-2)" }}>{story.description}</p>
        </div>

        {/* Audio player */}
        <div className="glass p-6 rounded-2xl mb-8">
          {/* Progress track */}
          <div
            className="relative h-2 rounded-full mb-4 overflow-hidden"
            style={{ background: "rgba(0,0,0,0.08)" }}
          >
            {/* Threshold marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 z-10"
              style={{ left: `${LISTEN_THRESHOLD * 100}%`, background: "rgba(245,158,11,0.5)" }}
            />
            {/* Max listened */}
            <div
              className="absolute top-0 h-full rounded-full transition-all"
              style={{ width: `${listenedMax * 100}%`, background: "rgba(245,158,11,0.25)" }}
            />
            {/* Current position */}
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress * 100}%`, background: "rgba(0,0,0,0.3)" }}
            />
          </div>

          <div className="flex items-center justify-between text-xs mb-4" style={{ color: "var(--text-3)" }}>
            <span>{fmt(currentSec)}</span>
            <span>{fmt(story.durationSeconds)}</span>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={togglePlay}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold transition-colors"
              style={{ background: "var(--text-1)", color: "#fff" }}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? "Pause" : "Play"}
            </button>

            {!ratingUnlocked && (
              <span className="text-xs" style={{ color: "var(--text-3)" }}>
                Listen to {Math.round(LISTEN_THRESHOLD * 100)}% to unlock rating
                <span className="ml-1" style={{ color: "var(--amber)" }}>
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
          <h2 className="font-semibold" style={{ color: "var(--text-1)" }}>Rate this story</h2>

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
            onChange={(v) => setCriteria((c) => ({ ...c, descriptionAccuracy: v }))}
            disabled={!ratingUnlocked}
          />

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitted}
            className="w-full py-3 rounded-xl font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
          >
            {submitted ? "Saved!" : "Submit evaluation"}
          </button>
        </div>
      </div>
    </div>
  );
}
