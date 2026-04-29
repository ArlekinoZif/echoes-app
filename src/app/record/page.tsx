"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AudioRecorder from "@/components/AudioRecorder";
import { Story, StoryCategory, PublishGate } from "@/lib/types";
import { saveStory } from "@/lib/store";
import { uploadAudioToR2 } from "@/lib/upload";
import { ArrowLeft, DollarSign, Users, Loader2 } from "lucide-react";
import Link from "next/link";

const CATEGORIES: StoryCategory[] = [
  "War",
  "Love",
  "Immigration",
  "Entrepreneurship",
  "Family",
  "Survival",
  "Other",
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

    let audioUrl = URL.createObjectURL(audioBlob);
    try {
      const result = await uploadAudioToR2(audioBlob);
      audioUrl = result.url;
    } catch (err) {
      // Fall back to local blob URL if R2 not configured yet
      console.warn("R2 upload skipped, using local blob URL:", err);
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
      status: "pending_eval",
    };

    saveStory(story);

    if (gate === "evaluate") {
      router.push("/evaluate");
    } else {
      router.push(`/tokenize/${story.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <Link
            href="/"
            className="p-2 rounded-full hover:bg-neutral-800 transition-colors text-neutral-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Record your story</h1>
            <p className="text-sm text-neutral-500">
              Step {step === "record" ? 1 : step === "details" ? 2 : 3} of 3
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-10">
          {(["record", "details", "gate"] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s === step
                  ? "bg-amber-500"
                  : i <
                      ["record", "details", "gate"].indexOf(step)
                    ? "bg-amber-800"
                    : "bg-neutral-800"
              }`}
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
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Story title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your story a title…"
                maxLength={80}
                required
                className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      category === c
                        ? "bg-amber-500 text-black"
                        : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Description
                <span className="text-neutral-600 font-normal ml-2">
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
                className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
              <p className="text-xs text-neutral-600 mt-1 text-right">
                {description.length}/500
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-semibold transition-colors"
            >
              Continue
            </button>
          </form>
        )}

        {/* Step 3: Publish gate */}
        {step === "gate" && (
          <div className="flex flex-col gap-6">
            <p className="text-neutral-400 text-sm">
              How do you want to publish{" "}
              <span className="text-white font-medium">&ldquo;{title}&rdquo;</span>?
            </p>

            <div className="flex flex-col gap-3">
              {/* Pay option */}
              <button
                onClick={() => setGate("pay")}
                className={`p-5 rounded-2xl border-2 text-left transition-colors ${
                  gate === "pay"
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-neutral-800 bg-neutral-900 hover:border-neutral-600"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-xl bg-amber-500/20">
                    <DollarSign className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-semibold">Pay to tokenize now</p>
                    <p className="text-sm text-neutral-400 mt-1">
                      ~0.2 SOL (~$18) — permanent on Arweave, listed on Bags
                      App immediately. You earn 80% of trading volume.
                    </p>
                  </div>
                </div>
              </button>

              {/* Evaluate option */}
              <button
                onClick={() => setGate("evaluate")}
                className={`p-5 rounded-2xl border-2 text-left transition-colors ${
                  gate === "evaluate"
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-neutral-800 bg-neutral-900 hover:border-neutral-600"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-xl bg-neutral-700">
                    <Users className="w-5 h-5 text-neutral-300" />
                  </div>
                  <div>
                    <p className="font-semibold">Evaluate 3 stories instead</p>
                    <p className="text-sm text-neutral-400 mt-1">
                      Listen to 80% of 3 stories and rate them. Free — your
                      story enters the weekly SKR vote pool.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black rounded-xl font-semibold transition-colors"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
                </span>
              ) : gate === "pay" ? "Proceed to payment" : "Start evaluating"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
