"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AudioRecorder from "@/components/AudioRecorder";
import { Story, StoryCategory, PublishGate } from "@/lib/types";
import { upsertStory } from "@/lib/db";
import { uploadAudioToR2, uploadImageToR2 } from "@/lib/upload";
import { useWallet } from "@/hooks/useWallet";
import { useIdentity } from "@/hooks/useIdentity";
import { ArrowLeft, DollarSign, Users, Loader2, AlertCircle, ImageIcon, X, CheckCircle, Check, Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

const CATEGORIES: StoryCategory[] = [
  "War", "Love", "Immigration", "Entrepreneurship", "Family", "Survival", "Other",
];

const INSTRUCTIONS = [
  { icon: "🔇", title: "Find a quiet spot", desc: "Minimize background noise." },
  { icon: "🎙️", title: "Check your mic", desc: "Use the best one available." },
  { icon: "❤️", title: "Speak from the heart", desc: "Avoid reading a script — keep it natural." },
  { icon: "🗺️", title: "Have a plan", desc: "Keep a mental outline to stay logical." },
  { icon: "🚫", title: "No taboos", desc: "Love, failures, lessons — anything goes." },
  { icon: "👋", title: "Always start with an intro", desc: "Who you are, your background." },
];

type Step = "instructions" | "record" | "details" | "gate";

export default function RecordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("instructions");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<StoryCategory>("Other");
  const [gate, setGate] = useState<PublishGate>("evaluate");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [enhanceAudio, setEnhanceAudio] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const { address } = useWallet();
  const { userId } = useIdentity();

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverImage(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  const handleRecordingComplete = useCallback((blob: Blob, duration: number) => {
    setAudioBlob(blob);
    setAudioDuration(duration);
    setStep("details");
  }, []);

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setStep("gate");
  };

  // Optionally run the recording through ElevenLabs noise removal before upload.
  // Falls back to the original audio if enhancement fails — never blocks publish.
  async function maybeEnhance(blob: Blob): Promise<Blob> {
    if (!enhanceAudio) return blob;
    setEnhancing(true);
    try {
      const res = await authenticatedFetch("/api/enhance-voice", {
        method: "POST",
        headers: { "x-content-type": blob.type || "audio/webm" },
        body: blob,
      });
      if (res.ok) return await res.blob();
      console.warn("Voice enhance failed, using original:", await res.text().catch(() => res.status));
      return blob;
    } catch (e) {
      console.warn("Voice enhance error, using original:", e);
      return blob;
    } finally {
      setEnhancing(false);
    }
  }

  const handleSubmit = async () => {
    if (!audioBlob) return;
    setSubmitting(true);
    setUploadError("");
    try {
      const audioToUpload = await maybeEnhance(audioBlob);
      const { url: audioUrl } = await uploadAudioToR2(audioToUpload);
      let coverImageUrl: string | undefined;
      if (coverImage) {
        try { coverImageUrl = (await uploadImageToR2(coverImage)).url; } catch { /* optional */ }
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
        ownerId: userId ?? undefined,
        authorWallet: address ?? undefined,
        coverImageUrl,
      };
      await upsertStory(story);
      router.push(gate === "evaluate" ? "/evaluate" : `/list/${story.id}`);
    } catch (err) {
      console.error("Submit failed:", err);
      setUploadError("Upload failed — please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const stepIdx = ["instructions", "record", "details", "gate"].indexOf(step);

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {step === "instructions" ? (
            <Link href="/" className="p-2 rounded-full transition-colors"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-2)" }}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          ) : (
            <button onClick={() => setStep(step === "record" ? "instructions" : step === "details" ? "record" : step === "gate" ? "details" : "instructions")}
              className="p-2 rounded-full transition-colors"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-2)" }}>
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>Record your story</h1>
            <p className="text-xs" style={{ color: "var(--text-3)" }}>Step {stepIdx + 1} of 4</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {["instructions", "record", "details", "gate"].map((s, i) => (
            <div key={s} className="h-0.5 flex-1 rounded-full transition-all"
              style={{
                background: i < stepIdx
                  ? "rgba(255,255,255,0.4)"
                  : i === stepIdx
                  ? "#ededed"
                  : "rgba(255,255,255,0.08)",
              }} />
          ))}
        </div>

        {/* ── Step 1: Instructions ── */}
        {step === "instructions" && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold mb-1" style={{ color: "var(--text-1)" }}>Before You Record</h2>
              <p className="text-sm" style={{ color: "var(--text-3)" }}>
                Your audio will be saved and tokenized.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {INSTRUCTIONS.map(({ icon, title: t, desc }) => (
                <div key={t} className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{t}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep("record")}
              className="btn-gold w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-95"
            >
              I understand, let&apos;s record 🎙️
            </button>
          </div>
        )}

        {/* ── Step 2: Record ── */}
        {step === "record" && (
          <AudioRecorder onRecordingComplete={handleRecordingComplete} />
        )}

        {/* ── Step 3: Details ── */}
        {step === "details" && (
          <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-5">
            {/* Cover image */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-2)" }}>
                Cover image <span className="font-normal" style={{ color: "var(--text-3)" }}>(optional)</span>
              </label>
              {coverPreview ? (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                  <Image src={coverPreview} alt="Cover" fill className="object-cover" />
                  <button type="button" onClick={() => { setCoverImage(null); setCoverPreview(""); }}
                    className="absolute top-2 right-2 p-1.5 rounded-full"
                    style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 w-full py-8 rounded-xl cursor-pointer transition-colors"
                  style={{ border: "2px dashed rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
                  <ImageIcon className="w-5 h-5" style={{ color: "var(--text-3)" }} />
                  <span className="text-sm" style={{ color: "var(--text-3)" }}>Tap to upload cover image</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                </label>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-2)" }}>Story title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Give your story a title…" maxLength={80} required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-1)" }} />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-2)" }}>Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button key={c} type="button" onClick={() => setCategory(c)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={category === c
                      ? { background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.3)", color: "var(--text-1)" }
                      : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-2)" }
                    }>{c}</button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-2)" }}>
                Description <span className="font-normal" style={{ color: "var(--text-3)" }}>(what is this story about?)</span>
              </label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Describe your story — evaluators will check if your description matches what they hear…"
                rows={4} maxLength={500} required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-1)" }} />
              <p className="text-xs mt-1 text-right" style={{ color: "var(--text-3)" }}>{description.length}/500</p>
            </div>

            <button type="submit"
              className="btn-gold w-full py-3.5 rounded-xl font-semibold transition-all active:scale-95">
              Continue
            </button>
          </form>
        )}

        {/* ── Step 4: Gate ── */}
        {step === "gate" && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-bold mb-1" style={{ color: "var(--text-1)" }}>Great Recording!</h2>
              <p className="text-sm" style={{ color: "var(--text-3)" }}>
                How would you like to publish 
                <span className="font-semibold" style={{ color: "var(--text-1)" }}>&ldquo;{title}&rdquo;</span>?
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button onClick={() => setGate("pay")}
                className="p-5 rounded-2xl text-left transition-all"
                style={{
                  border: gate === "pay" ? "1.5px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.08)",
                  background: gate === "pay" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                }}>
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: "rgba(245,200,66,0.12)" }}>
                    <DollarSign className="w-5 h-5" style={{ color: "var(--amber)" }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-sm" style={{ color: "var(--text-1)" }}>Instant publish</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(200,168,75,0.12)", color: "#c8a84b" }}>FAST</span>
                    </div>
                    <p className="text-sm" style={{ color: "var(--text-2)" }}>
                      Pay <span className="font-bold" style={{ color: "var(--amber)" }}>2400 $ECHOES</span> — story is listed immediately and enters the weekly vote pool.
                    </p>
                  </div>
                </div>
                {gate === "pay" && <CheckCircle className="w-4 h-4 mt-3 ml-auto" style={{ color: "#ededed" }} />}
              </button>

              <button onClick={() => setGate("evaluate")}
                className="p-5 rounded-2xl text-left transition-all"
                style={{
                  border: gate === "evaluate" ? "1.5px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.08)",
                  background: gate === "evaluate" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                }}>
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <Users className="w-5 h-5" style={{ color: "var(--text-2)" }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-sm" style={{ color: "var(--text-1)" }}>Community review</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-2)" }}>FREE</span>
                    </div>
                    <p className="text-sm" style={{ color: "var(--text-2)" }}>
                      Listen to 3 stories and rate them. Free — your story gets listed and enters the vote pool.
                    </p>
                  </div>
                </div>
                {gate === "evaluate" && <CheckCircle className="w-4 h-4 mt-3 ml-auto" style={{ color: "#ededed" }} />}
              </button>
            </div>

            {/* Optional ElevenLabs voice enhancement */}
            <button type="button" onClick={() => setEnhanceAudio(v => !v)}
              className="flex items-start gap-3 p-3.5 rounded-2xl text-left transition-all"
              style={enhanceAudio
                ? { background: "rgba(245,200,66,0.06)", border: "1.5px solid rgba(245,200,66,0.35)" }
                : { background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.08)" }
              }>
              <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: enhanceAudio ? "var(--amber)" : "rgba(255,255,255,0.06)", border: enhanceAudio ? "none" : "1px solid rgba(255,255,255,0.15)" }}>
                {enhanceAudio && <Check className="w-3.5 h-3.5" style={{ color: "#0c0c0c" }} />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--amber)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>Enhance voice <span className="font-normal" style={{ color: "var(--text-3)" }}>(optional)</span></p>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                  Remove background noise & room echo with ElevenLabs before publishing.
                </p>
              </div>
            </button>

            {uploadError && (
              <div className="flex items-start gap-2 p-3 rounded-xl text-sm"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {uploadError}
              </div>
            )}

            <button onClick={handleSubmit} disabled={submitting}
              className="btn-gold w-full py-4 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50">
              {enhancing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Enhancing audio…
                </span>
              ) : submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
                </span>
              ) : gate === "pay" ? "Pay 2400 $ECHOES to list" : "Start evaluating (0/3)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
