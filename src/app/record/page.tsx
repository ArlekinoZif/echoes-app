"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AudioRecorder from "@/components/AudioRecorder";
import { Story, StoryCategory, PublishGate } from "@/lib/types";
import { upsertStory } from "@/lib/db";
import { uploadAudioToR2, uploadImageToR2 } from "@/lib/upload";
import { useWallet } from "@/hooks/useWallet";
import { usePrivy } from "@privy-io/react-auth";
import {
  ArrowLeft,
  DollarSign,
  Users,
  Loader2,
  AlertCircle,
  ImageIcon,
  X,
  Mic,
  Type,
  Play,
  Pause,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const CATEGORIES: StoryCategory[] = [
  "War", "Love", "Immigration", "Entrepreneurship", "Family", "Survival", "Other",
];

const TTS_VOICES = [
  { id: "M1", label: "Natural male" },
  { id: "M2", label: "Warm male" },
  { id: "F1", label: "Natural female" },
  { id: "F2", label: "Warm female" },
  { id: "F3", label: "Clear female" },
];

type Step = "record" | "details" | "gate";
type RecordMode = "mic" | "type";

export default function RecordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("record");
  const [recordMode, setRecordMode] = useState<RecordMode>("mic");

  // Mic mode state
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);

  // Type / TTS mode state
  const [typeText, setTypeText] = useState("");
  const [ttsVoice, setTtsVoice] = useState("M1");
  const [generating, setGenerating] = useState(false);
  const [ttsError, setTtsError] = useState("");
  const [ttsBlob, setTtsBlob] = useState<Blob | null>(null);
  const [ttsPreviewUrl, setTtsPreviewUrl] = useState("");
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsAudio, setTtsAudio] = useState<HTMLAudioElement | null>(null);

  // Details step state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [transcriptFilled, setTranscriptFilled] = useState(false);
  const [category, setCategory] = useState<StoryCategory>("Other");
  const [gate, setGate] = useState<PublishGate>("evaluate");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const { address } = useWallet();
  const { user } = usePrivy();
  const twitterAccount = user?.linkedAccounts?.find((a) => a.type === "twitter_oauth") as
    | { type: "twitter_oauth"; username?: string; name?: string }
    | undefined;

  // ── Cover image ────────────────────────────────────────────────────────────

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverImage(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function removeCover() {
    setCoverImage(null);
    setCoverPreview("");
  }

  // ── Mic mode ───────────────────────────────────────────────────────────────

  const handleRecordingComplete = useCallback(
    (blob: Blob, dur: number, transcript?: string) => {
      setAudioBlob(blob);
      setAudioDuration(dur);
      if (transcript?.trim()) {
        setDescription(transcript.trim());
        setTranscriptFilled(true);
      }
      setStep("details");
    },
    []
  );

  // ── Type / TTS mode ────────────────────────────────────────────────────────

  async function generateAudio() {
    if (!typeText.trim()) return;
    setGenerating(true);
    setTtsError("");
    // Stop any existing preview
    if (ttsAudio) { ttsAudio.pause(); setTtsAudio(null); }
    setTtsBlob(null);
    setTtsPreviewUrl("");

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: typeText.trim(), voice: ttsVoice }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error ?? "TTS failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setTtsBlob(blob);
      setTtsPreviewUrl(url);

      // Estimate duration from WAV blob size (44 header + samples @ 44100 Hz 16-bit mono)
      const durationEst = Math.round((blob.size - 44) / (44100 * 2));
      setAudioDuration(Math.max(1, durationEst));
    } catch (err) {
      setTtsError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function toggleTtsPreview() {
    if (!ttsPreviewUrl) return;
    if (ttsAudio) {
      if (ttsPlaying) { ttsAudio.pause(); setTtsPlaying(false); }
      else { ttsAudio.play(); setTtsPlaying(true); }
    } else {
      const a = new Audio(ttsPreviewUrl);
      a.onended = () => setTtsPlaying(false);
      setTtsAudio(a);
      a.play();
      setTtsPlaying(true);
    }
  }

  function useTtsAudio() {
    if (!ttsBlob) return;
    setAudioBlob(ttsBlob);
    // Use typed text as description seed
    if (typeText.trim()) {
      setDescription(typeText.trim());
      setTranscriptFilled(true);
    }
    setStep("details");
  }

  // ── Gate / submit ──────────────────────────────────────────────────────────

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setStep("gate");
  };

  const handleSubmit = async () => {
    if (!audioBlob) return;
    setSubmitting(true);
    setUploadError("");

    let audioUrl: string;
    try {
      const result = await uploadAudioToR2(audioBlob);
      audioUrl = result.url;
    } catch (err) {
      console.error("R2 upload failed:", err);
      setUploadError("Upload failed — please check your connection and try again.");
      setSubmitting(false);
      return;
    }

    let coverImageUrl: string | undefined;
    if (coverImage) {
      try {
        const result = await uploadImageToR2(coverImage);
        coverImageUrl = result.url;
      } catch (err) {
        console.error("Cover image upload failed:", err);
      }
    }

    const story: Story = {
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description.trim(),
      category,
      audioBlobUrl: audioUrl,
      durationSeconds: audioDuration,
      publishGate: gate,
      createdAt: Date.now(),
      status: gate === "pay" ? "draft" : "pending_eval",
      authorWallet: address ?? undefined,
      coverImageUrl,
      authorTwitter: twitterAccount
        ? (twitterAccount.username ?? twitterAccount.name ?? undefined)
        : undefined,
    };

    try {
      await upsertStory(story);
    } catch (err) {
      console.error("Failed to save story:", err);
    }

    if (gate === "evaluate") {
      router.push("/evaluate");
    } else {
      router.push(`/list/${story.id}`);
    }
  };

  const stepNum = step === "record" ? 1 : step === "details" ? 2 : 3;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/"
            className="p-2 rounded-full transition-colors"
            style={{
              background: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(0,0,0,0.07)",
              color: "var(--text-2)",
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-1)" }}>
              Record your story
            </h1>
            <p className="text-sm" style={{ color: "var(--text-3)" }}>
              Step {stepNum} of 3
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-10">
          {(["record", "details", "gate"] as Step[]).map((s, i) => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{
                background:
                  s === step
                    ? "linear-gradient(90deg, #00c6be, #ff6b9d)"
                    : i < (["record", "details", "gate"] as Step[]).indexOf(step)
                    ? "rgba(245,158,11,0.4)"
                    : "rgba(0,0,0,0.08)",
              }}
            />
          ))}
        </div>

        {/* ── Step 1: Record / Type ────────────────────────────────────────── */}
        {step === "record" && (
          <div className="flex flex-col gap-6">
            {/* Mode toggle */}
            <div
              className="flex p-1 rounded-2xl"
              style={{ background: "rgba(0,0,0,0.05)" }}
            >
              {(["mic", "type"] as RecordMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setRecordMode(m)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={
                    recordMode === m
                      ? {
                          background: "#fff",
                          color: "var(--text-1)",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                        }
                      : { color: "var(--text-3)" }
                  }
                >
                  {m === "mic" ? (
                    <><Mic className="w-4 h-4" /> Record</>
                  ) : (
                    <><Type className="w-4 h-4" /> Type</>
                  )}
                </button>
              ))}
            </div>

            {/* Mic mode */}
            {recordMode === "mic" && (
              <AudioRecorder onRecordingComplete={handleRecordingComplete} />
            )}

            {/* Type / TTS mode */}
            {recordMode === "type" && (
              <div className="flex flex-col gap-5">
                <div
                  className="p-4 rounded-2xl text-sm"
                  style={{
                    background: "rgba(199,125,255,0.07)",
                    border: "1px solid rgba(199,125,255,0.2)",
                    color: "var(--text-2)",
                  }}
                >
                  <span className="font-semibold" style={{ color: "#c77dff" }}>AI voice synthesis</span>
                  {" "}— type your story and we&apos;ll convert it to a natural voice using QVAC (local AI, no data leaves our server).
                </div>

                {/* Story textarea */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-2)" }}>
                    Your story
                  </label>
                  <textarea
                    value={typeText}
                    onChange={(e) => setTypeText(e.target.value)}
                    placeholder="Type your story here… it will be read aloud by the AI voice."
                    rows={6}
                    maxLength={2000}
                    className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none resize-none"
                    style={{
                      background: "rgba(255,255,255,0.7)",
                      border: "1px solid rgba(0,0,0,0.1)",
                      color: "var(--text-1)",
                    }}
                  />
                  <p className="text-xs mt-1 text-right" style={{ color: "var(--text-3)" }}>
                    {typeText.length}/2000
                  </p>
                </div>

                {/* Voice selector */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-2)" }}>
                    Voice
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TTS_VOICES.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setTtsVoice(v.id)}
                        className="px-4 py-2 rounded-full text-sm font-medium transition-colors"
                        style={
                          ttsVoice === v.id
                            ? {
                                background: "linear-gradient(135deg, #00c6be, #c77dff)",
                                color: "#fff",
                              }
                            : {
                                background: "rgba(255,255,255,0.6)",
                                border: "1px solid rgba(0,0,0,0.08)",
                                color: "var(--text-2)",
                              }
                        }
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* TTS error */}
                {ttsError && (
                  <div
                    className="flex items-start gap-2 p-3 rounded-xl text-sm"
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.25)",
                      color: "#dc2626",
                    }}
                  >
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {ttsError}
                  </div>
                )}

                {/* Preview player (shown after generation) */}
                {ttsPreviewUrl && (
                  <div
                    className="flex items-center gap-3 p-4 rounded-2xl"
                    style={{
                      background: "rgba(255,255,255,0.7)",
                      border: "1px solid rgba(0,0,0,0.08)",
                    }}
                  >
                    <button
                      onClick={toggleTtsPreview}
                      className="p-2.5 rounded-full flex-shrink-0"
                      style={{
                        background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)",
                        color: "#fff",
                      }}
                    >
                      {ttsPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--text-1)" }}>
                        Preview generated audio
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                        ~{audioDuration}s · {TTS_VOICES.find((v) => v.id === ttsVoice)?.label}
                      </p>
                    </div>
                    <button
                      onClick={useTtsAudio}
                      className="px-4 py-2 rounded-full text-sm font-semibold flex-shrink-0"
                      style={{
                        background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)",
                        color: "#fff",
                      }}
                    >
                      Use this
                    </button>
                  </div>
                )}

                {/* Generate button */}
                <button
                  onClick={generateAudio}
                  disabled={!typeText.trim() || generating}
                  className="w-full py-3 rounded-xl font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)",
                    color: "#fff",
                  }}
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating audio…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {ttsPreviewUrl ? "Regenerate audio" : "Generate audio"}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Details ──────────────────────────────────────────────── */}
        {step === "details" && (
          <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-6">

            {/* Cover image */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-2)" }}>
                Cover image
                <span className="font-normal ml-2" style={{ color: "var(--text-3)" }}>(optional)</span>
              </label>
              {coverPreview ? (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                  <Image src={coverPreview} alt="Cover" fill className="object-cover" />
                  <button
                    type="button"
                    onClick={removeCover}
                    className="absolute top-2 right-2 p-1.5 rounded-full"
                    style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center justify-center gap-2 w-full py-8 rounded-xl cursor-pointer transition-colors"
                  style={{
                    border: "2px dashed rgba(0,0,0,0.1)",
                    background: "rgba(255,255,255,0.5)",
                  }}
                >
                  <ImageIcon className="w-6 h-6" style={{ color: "var(--text-3)" }} />
                  <span className="text-sm" style={{ color: "var(--text-3)" }}>
                    Tap to upload or paste an image
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverChange}
                  />
                </label>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-2)" }}>
                Story title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your story a title…"
                maxLength={80}
                required
                className="w-full px-4 py-3 rounded-xl text-sm transition-colors focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(0,0,0,0.1)",
                  color: "var(--text-1)",
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-2)" }}>
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className="px-4 py-2 rounded-full text-sm font-medium transition-colors"
                    style={
                      category === c
                        ? {
                            background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)",
                            color: "#fff",
                          }
                        : {
                            background: "rgba(255,255,255,0.6)",
                            border: "1px solid rgba(0,0,0,0.08)",
                            color: "var(--text-2)",
                          }
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium" style={{ color: "var(--text-2)" }}>
                  Description
                  <span className="font-normal ml-2" style={{ color: "var(--text-3)" }}>
                    (what is this story about?)
                  </span>
                </label>
                {transcriptFilled && (
                  <span
                    className="text-xs flex items-center gap-1"
                    style={{ color: "#10b981" }}
                  >
                    <Sparkles className="w-3 h-3" /> AI pre-filled
                  </span>
                )}
              </div>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setTranscriptFilled(false); }}
                placeholder="Describe your story accurately — evaluators will check if your description matches what they hear…"
                rows={4}
                maxLength={500}
                required
                className="w-full px-4 py-3 rounded-xl text-sm transition-colors focus:outline-none resize-none"
                style={{
                  background: transcriptFilled
                    ? "rgba(16,185,129,0.04)"
                    : "rgba(255,255,255,0.7)",
                  border: transcriptFilled
                    ? "1px solid rgba(16,185,129,0.3)"
                    : "1px solid rgba(0,0,0,0.1)",
                  color: "var(--text-1)",
                }}
              />
              <p className="text-xs mt-1 text-right" style={{ color: "var(--text-3)" }}>
                {description.length}/500
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl font-semibold transition-opacity hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)",
                color: "#fff",
              }}
            >
              Continue
            </button>
          </form>
        )}

        {/* ── Step 3: Publish gate ─────────────────────────────────────────── */}
        {step === "gate" && (
          <div className="flex flex-col gap-6">
            <p className="text-sm" style={{ color: "var(--text-2)" }}>
              How do you want to publish{" "}
              <span className="font-semibold" style={{ color: "var(--text-1)" }}>
                &ldquo;{title}&rdquo;
              </span>?
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setGate("pay")}
                className="p-5 rounded-2xl text-left transition-colors"
                style={{
                  border: gate === "pay" ? "2px solid #00c6be" : "2px solid rgba(0,0,0,0.07)",
                  background: gate === "pay" ? "rgba(0,198,190,0.06)" : "rgba(255,255,255,0.6)",
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="p-2 rounded-xl flex-shrink-0"
                    style={{ background: "rgba(245,158,11,0.12)" }}
                  >
                    <DollarSign className="w-5 h-5" style={{ color: "var(--amber)" }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "var(--text-1)" }}>
                      Pay $1 to list
                    </p>
                    <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
                      2400 $ECHOES — your story is listed immediately and enters the weekly vote pool.
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setGate("evaluate")}
                className="p-5 rounded-2xl text-left transition-colors"
                style={{
                  border: gate === "evaluate" ? "2px solid #ff6b9d" : "2px solid rgba(0,0,0,0.07)",
                  background:
                    gate === "evaluate" ? "rgba(255,107,157,0.06)" : "rgba(255,255,255,0.6)",
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="p-2 rounded-xl flex-shrink-0"
                    style={{ background: "rgba(0,0,0,0.05)" }}
                  >
                    <Users className="w-5 h-5" style={{ color: "var(--text-2)" }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "var(--text-1)" }}>
                      Evaluate 3 stories instead
                    </p>
                    <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
                      Listen to 80% of 3 stories and rate them. Free — your story gets listed and enters the weekly vote pool.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {uploadError && (
              <div
                className="flex items-start gap-2 p-3 rounded-xl text-sm"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: "#dc2626",
                }}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {uploadError}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)",
                color: "#fff",
              }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
                </span>
              ) : gate === "pay" ? (
                "Pay 2400 $ECHOES to list"
              ) : (
                "Start evaluating"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
