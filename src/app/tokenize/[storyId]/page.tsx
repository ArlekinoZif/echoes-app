"use client";

import { use, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStory, saveStory } from "@/lib/store";
import { Story } from "@/lib/types";
import { connectWallet, getConnectedWallet } from "@/lib/wallet";
import { uploadToArweave, estimateArweaveCost } from "@/lib/arweave";
import { ArrowLeft, Wallet, Upload, Zap, CheckCircle, ExternalLink, Loader2 } from "lucide-react";

type Step = "wallet" | "cost" | "arweave" | "bags" | "done";

interface StepState {
  status: "idle" | "loading" | "done" | "error";
  detail?: string;
}

const STEPS: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: "wallet", label: "Connect wallet", icon: <Wallet className="w-4 h-4" /> },
  { id: "cost", label: "Confirm cost", icon: <Zap className="w-4 h-4" /> },
  { id: "arweave", label: "Upload to Arweave", icon: <Upload className="w-4 h-4" /> },
  { id: "bags", label: "List on Bags App", icon: <Zap className="w-4 h-4" /> },
  { id: "done", label: "Done!", icon: <CheckCircle className="w-4 h-4" /> },
];

export default function TokenizePage({ params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = use(params);
  const router = useRouter();
  const [story, setStory] = useState<Story | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>("wallet");
  const [stepStates, setStepStates] = useState<Record<Step, StepState>>({
    wallet: { status: "idle" },
    cost: { status: "idle" },
    arweave: { status: "idle" },
    bags: { status: "idle" },
    done: { status: "idle" },
  });
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [costLamports, setCostLamports] = useState<bigint>(BigInt(0));
  const [arweaveUrl, setArweaveUrl] = useState<string>("");
  const [bagsUrl, setBagsUrl] = useState<string>("");
  const audioBlobRef = useRef<Blob | null>(null);

  const setStep = (step: Step, state: StepState) =>
    setStepStates((prev) => ({ ...prev, [step]: state }));

  useEffect(() => {
    const s = getStory(storyId);
    if (!s) { router.push("/"); return; }
    setStory(s);

    // Pre-fetch audio blob for size estimation
    fetch(s.audioBlobUrl)
      .then((r) => r.blob())
      .then((b) => {
        audioBlobRef.current = b;
        return estimateArweaveCost(b.size);
      })
      .then(setCostLamports)
      .catch(console.warn);

    // Auto-connect if already connected
    const addr = getConnectedWallet();
    if (addr) { setWalletAddress(addr); setCurrentStep("cost"); setStep("wallet", { status: "done", detail: addr }); }
  }, [storyId, router]);

  const handleConnectWallet = async () => {
    setStep("wallet", { status: "loading" });
    try {
      const addr = await connectWallet();
      setWalletAddress(addr);
      setStep("wallet", { status: "done", detail: addr });
      setCurrentStep("cost");
    } catch (e: unknown) {
      setStep("wallet", { status: "error", detail: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleConfirmCost = () => {
    setStep("cost", { status: "done" });
    setCurrentStep("arweave");
    handleArweaveUpload();
  };

  const handleArweaveUpload = async () => {
    if (!story || !audioBlobRef.current) return;
    setStep("arweave", { status: "loading" });
    try {
      const result = await uploadToArweave(audioBlobRef.current, {
        title: story.title,
        description: story.description,
        category: story.category,
      });
      setArweaveUrl(result.url);
      setStep("arweave", { status: "done", detail: result.id });
      setCurrentStep("bags");
      handleBagsLaunch(result.url, result.id);
    } catch (e: unknown) {
      setStep("arweave", { status: "error", detail: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleBagsLaunch = async (audioUrl: string, arweaveTxId: string) => {
    if (!story || !walletAddress) return;
    setStep("bags", { status: "loading" });
    try {
      const res = await fetch("/api/bags-launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: story.title,
          description: story.description,
          audioUrl,
          arweaveTxId,
          category: story.category,
          authorWallet: walletAddress,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setBagsUrl(data.listingUrl);

      // Update story status in store
      saveStory({ ...story, status: "tokenized", audioBlobUrl: audioUrl });
      setStep("bags", { status: "done", detail: data.tokenAddress });
      setCurrentStep("done");
      setStep("done", { status: "done" });
    } catch (e: unknown) {
      setStep("bags", { status: "error", detail: e instanceof Error ? e.message : String(e) });
    }
  };

  const solCost = Number(costLamports) / 1e9;

  if (!story) return null;

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="p-2 rounded-full hover:bg-neutral-800 transition-colors text-neutral-400">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Tokenize story</h1>
            <p className="text-sm text-neutral-500 truncate max-w-xs">{story.title}</p>
          </div>
        </div>

        {/* Step list */}
        <div className="flex flex-col gap-3 mb-8">
          {STEPS.map((s, i) => {
            const state = stepStates[s.id];
            const isCurrent = s.id === currentStep && state.status !== "done";
            const isPast = state.status === "done";
            const isError = state.status === "error";

            return (
              <div
                key={s.id}
                className={`p-4 rounded-2xl border transition-colors ${
                  isCurrent
                    ? "border-amber-500 bg-amber-500/5"
                    : isPast
                    ? "border-neutral-700 bg-neutral-900/50"
                    : isError
                    ? "border-red-800 bg-red-900/10"
                    : "border-neutral-800 bg-neutral-900/30"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        isPast
                          ? "bg-amber-500 text-black"
                          : isError
                          ? "bg-red-600 text-white"
                          : isCurrent
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500"
                          : "bg-neutral-800 text-neutral-600"
                      }`}
                    >
                      {isPast ? "✓" : isError ? "!" : i + 1}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${isCurrent ? "text-white" : isPast ? "text-neutral-400" : "text-neutral-600"}`}>
                        {s.label}
                      </p>
                      {state.detail && (
                        <p className={`text-xs mt-0.5 font-mono truncate max-w-xs ${isError ? "text-red-400" : "text-neutral-500"}`}>
                          {state.detail}
                        </p>
                      )}
                    </div>
                  </div>
                  {state.status === "loading" && <Loader2 className="w-4 h-4 animate-spin text-amber-400" />}
                </div>

                {/* Step actions */}
                {isCurrent && s.id === "wallet" && (
                  <button
                    onClick={handleConnectWallet}
                    className="mt-4 w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-semibold text-sm transition-colors"
                  >
                    Connect Phantom
                  </button>
                )}

                {isCurrent && s.id === "cost" && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-4">
                      <span className="text-neutral-400">Arweave storage</span>
                      <span className="text-white font-mono">
                        {solCost > 0 ? `~${solCost.toFixed(4)} SOL` : "calculating…"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-4">
                      <span className="text-neutral-400">Bags App listing fee</span>
                      <span className="text-white font-mono">0.2 SOL</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold border-t border-neutral-800 pt-3 mb-4">
                      <span>Total (approx)</span>
                      <span className="text-amber-400">~{(solCost + 0.2).toFixed(4)} SOL</span>
                    </div>
                    <button
                      onClick={handleConfirmCost}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-semibold text-sm transition-colors"
                    >
                      Confirm &amp; upload
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Done state */}
        {currentStep === "done" && (
          <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500 text-center">
            <CheckCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold mb-1">Your story is live!</h2>
            <p className="text-sm text-neutral-400 mb-4">
              Preserved forever on Arweave. Trading on Bags App now.
            </p>
            <div className="flex flex-col gap-2">
              {arweaveUrl && (
                <a
                  href={arweaveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-sm transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> View on Arweave
                </a>
              )}
              {bagsUrl && (
                <a
                  href={bagsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-sm font-semibold transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Trade on Bags App
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
