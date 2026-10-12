"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { fetchStory, upsertEvaluation } from "@/lib/db";
import { useIdentity } from "@/hooks/useIdentity";
import { Story, EvaluationCriteria } from "@/lib/types";
import { Play, Pause, ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";

const LISTEN_THRESHOLD = 0.8;

function RatingRow({ label, hint, value, onChange, disabled }: {
  label: string; hint: string; value: number;
  onChange: (v: number) => void; disabled?: boolean;
}) {
  const LABELS = ["Poor", "Fair", "Good", "Great", "Excellent"];
  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{label}</span>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{hint}</p>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} disabled={disabled} onClick={() => onChange(star)}
            className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all disabled:cursor-not-allowed"
            style={star <= value
              ? { background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.3)", color: "var(--text-1)" }
              : { background: "rgba(255,255,255,0.04)", color: "var(--text-3)", border: "1px solid rgba(255,255,255,0.08)" }
            }>
            {LABELS[star - 1]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function EvaluateStoryPage({ params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = use(params);
  const router = useRouter();
  const { userId } = useIdentity();
  const [story, setStory] = useState<Story | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [listenedMax, setListenedMax] = useState(0);
  const [criteria, setCriteria] = useState<EvaluationCriteria>({ audioQuality: 0, storytelling: 0, descriptionAccuracy: 0 });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let audio: HTMLAudioElement | null = null;
    fetchStory(storyId).then((s: Story | null) => {
      if (!s) { router.push("/evaluate"); return; }
      setStory(s);
      audio = new Audio(s.audioBlobUrl);
      audioRef.current = audio;
      audio.ontimeupdate = () => {
        const frac = audio!.currentTime / (audio!.duration || 1);
        setProgress(frac);
        setListenedMax(prev => Math.max(prev, frac));
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
  const canSubmit = ratingUnlocked && criteria.audioQuality > 0 && criteria.storytelling > 0 && criteria.descriptionAccuracy > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !story || submitting) return;
    if (!userId) { setSubmitError("Please log in to submit an evaluation."); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      await upsertEvaluation({ storyId: story.id, criteria, listenedPercent: Math.round(listenedMax * 100) }, userId);
      setSubmitted(true);
      setTimeout(() => router.push("/evaluate"), 1500);
    } catch (err) {
      console.error(err);
      setSubmitError(err instanceof Error ? err.message : "Failed to save evaluation.");
    }
    finally { setSubmitting(false); }
  };

  if (!story) return null;

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const currentSec = Math.floor(progress * story.durationSeconds);

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-6">
        {/* Back */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/evaluate" className="p-2 rounded-full transition-colors"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-2)" }}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="text-sm" style={{ color: "var(--text-3)" }}>Back to list</span>
        </div>

        {/* Story info */}
        <div className="mb-6">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ color: "var(--amber)", background: "rgba(245,200,66,0.1)" }}>
            {story.category}
          </span>
          <h1 className="text-2xl font-bold mt-3" style={{ color: "var(--text-1)" }}>{story.title}</h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-2)" }}>{story.description}</p>
        </div>

        {/* Player */}
        <div className="glass p-5 rounded-2xl mb-6">
          {/* Track */}
          <div className="relative h-1.5 rounded-full mb-3 overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="absolute top-0 bottom-0 w-px z-10"
              style={{ left: `${LISTEN_THRESHOLD * 100}%`, background: "rgba(245,200,66,0.6)" }} />
            <div className="absolute top-0 h-full rounded-full"
              style={{ width: `${listenedMax * 100}%`, background: "rgba(245,200,66,0.2)" }} />
            <div className="h-full rounded-full"
              style={{ width: `${progress * 100}%`, background: "rgba(255,255,255,0.55)" }} />
          </div>

          <div className="flex items-center justify-between text-xs mb-4" style={{ color: "var(--text-3)" }}>
            <span>{fmt(currentSec)}</span>
            {!ratingUnlocked && (
              <span>Listen to {Math.round(LISTEN_THRESHOLD * 100)}% to unlock rating
                <span className="ml-1" style={{ color: "var(--amber)" }}>({Math.round(listenedMax * 100)}%)</span>
              </span>
            )}
            <span>{fmt(story.durationSeconds)}</span>
          </div>

          <button onClick={togglePlay}
            className="btn-gold flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all active:scale-95">
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? "Pause" : "Play story"}
          </button>
        </div>

        {/* Rating */}
        <div className={`flex flex-col gap-5 transition-opacity ${ratingUnlocked ? "opacity-100" : "opacity-25 pointer-events-none"}`}>
          <h2 className="font-bold" style={{ color: "var(--text-1)" }}>Rate this story</h2>
          <RatingRow label="Audio quality" hint="Clear voice, no noise or distortion?"
            value={criteria.audioQuality} onChange={v => setCriteria(c => ({ ...c, audioQuality: v }))} disabled={!ratingUnlocked} />
          <RatingRow label="Storytelling" hint="Logically structured and interesting to listen to?"
            value={criteria.storytelling} onChange={v => setCriteria(c => ({ ...c, storytelling: v }))} disabled={!ratingUnlocked} />
          <RatingRow label="Description accuracy" hint="Does the title/description match what the story is actually about?"
            value={criteria.descriptionAccuracy} onChange={v => setCriteria(c => ({ ...c, descriptionAccuracy: v }))} disabled={!ratingUnlocked} />

          <button onClick={handleSubmit} disabled={!canSubmit || submitted || submitting}
            className="btn-gold w-full py-4 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed mt-2">
            {submitted ? (
              <span className="flex items-center justify-center gap-2"><CheckCircle className="w-4 h-4" /> Saved!</span>
            ) : submitting ? "Saving…" : "Submit evaluation"}
          </button>
          {submitError && (
            <p className="text-xs text-center" style={{ color: "#ef4444" }}>{submitError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
