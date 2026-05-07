"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AudioRecorder from "@/components/AudioRecorder";
import { Story, StoryCategory, PublishGate } from "@/lib/types";
import { upsertStory } from "@/lib/db";
import { uploadAudioToR2 } from "@/lib/upload";
import { useWallet } from "@/hooks/useWallet";
import { ArrowLeft, DollarSign, Users, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

const CATEGORIES: StoryCategory[] = [
  "War", "Love", "Immigration", "Entrepreneurship", "Family", "Survival", "Other",
];

type Step = "record" | "details" | "gate";

export default function RecordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("record");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<StoryCategory>("Other");
  const [gate, setGate] = useState<PublishGate>("evaluate");
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const { address } = useWallet();

  const handleRecordingComplete = useCallback(
    (blob: Blob, duration: number) => {
      setAudioBlob(blob);
      setAudioDuration(duration);
      setStep("details");
    },
    []
  );

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
            style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.07)", color: "var(--text-2)" }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-1)" }}>Record your story</h1>
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
                    : i < ["record", "details", "gate"].indexOf(step)
                    ? "rgba(245,158,11,0.4)"
                    : "rgba(0,0,0,0.08)",
              }}
            />
          ))}
        </div>

        {/* Step 1: Record */}
        {step === "record" && (
          <AudioRecorder onRecordingComplete={handleRecordingComplete} />
        )}

        {/* Step 2: Details */}
        {step === "details" && (
          <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-6">
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
                        ? { background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }
                        : { background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)", color: "var(--text-2)" }
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-2)" }}>
                Description
                <span className="font-normal ml-2" style={{ color: "var(--text-3)" }}>
                  (what is this story about?)
                </span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your story accurately — evaluators will check if your description matches what they hear…"
                rows={4}
                maxLength={500}
                required
                className="w-full px-4 py-3 rounded-xl text-sm transition-colors focus:outline-none resize-none"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(0,0,0,0.1)",
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
              style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
            >
              Continue
            </button>
          </form>
        )}

        {/* Step 3: Publish gate */}
        {step === "gate" && (
          <div className="flex flex-col gap-6">
            <p className="text-sm" style={{ color: "var(--text-2)" }}>
              How do you want to publish{" "}
              <span className="font-semibold" style={{ color: "var(--text-1)" }}>&ldquo;{title}&rdquo;</span>?
            </p>

            <div className="flex flex-col gap-3">
              {/* Pay option */}
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
                    <p className="font-semibold text-sm" style={{ color: "var(--text-1)" }}>Pay $1 to list</p>
                    <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
                      $1 in $ECHOES tokens — your story is listed immediately
                      and enters the weekly vote pool.
                    </p>
                  </div>
                </div>
              </button>

              {/* Evaluate option */}
              <button
                onClick={() => setGate("evaluate")}
                className="p-5 rounded-2xl text-left transition-colors"
                style={{
                  border: gate === "evaluate" ? "2px solid #ff6b9d" : "2px solid rgba(0,0,0,0.07)",
                  background: gate === "evaluate" ? "rgba(255,107,157,0.06)" : "rgba(255,255,255,0.6)",
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
                    <p className="font-semibold text-sm" style={{ color: "var(--text-1)" }}>Evaluate 3 stories instead</p>
                    <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
                      Listen to 80% of 3 stories and rate them. Free — your
                      story gets listed and enters the weekly vote pool.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {uploadError && (
              <div
                className="flex items-start gap-2 p-3 rounded-xl text-sm"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#dc2626" }}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {uploadError}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
                </span>
              ) : gate === "pay" ? "Pay $1 in $ECHOES to list" : "Start evaluating"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
