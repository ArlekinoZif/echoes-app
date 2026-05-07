"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { fetchStory, upsertStory } from "@/lib/db";
import { Story } from "@/lib/types";
import { useWallet } from "@/hooks/useWallet";
import {
  ArrowLeft, Wallet, Zap, CheckCircle, ExternalLink,
  Loader2, ImageIcon,
} from "lucide-react";

type Step = "wallet" | "details" | "launch" | "done";
type StepStatus = "idle" | "loading" | "done" | "error";

interface StepState {
  status: StepStatus;
  detail?: string;
}

const STEP_META: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: "wallet", label: "Connect wallet", icon: <Wallet className="w-4 h-4" /> },
  { id: "details", label: "Token details", icon: <ImageIcon className="w-4 h-4" /> },
  { id: "launch", label: "Launch on Bags App", icon: <Zap className="w-4 h-4" /> },
  { id: "done", label: "Done!", icon: <CheckCircle className="w-4 h-4" /> },
];

const STEPS: Step[] = STEP_META.map((s) => s.id);

function initStates(): Record<Step, StepState> {
  return Object.fromEntries(STEPS.map((s) => [s, { status: "idle" }])) as Record<Step, StepState>;
}

function toMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function TokenizePage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = use(params);
  const router = useRouter();

  const [isSponsor, setIsSponsor] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setIsSponsor(p.get("sponsor") === "1");
  }, []);

  const { authenticated, address, connect, signAndSendAllBase64Txs } = useWallet();

  const [story, setStory] = useState<Story | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>("wallet");
  const [stepStates, setStepStates] = useState<Record<Step, StepState>>(initStates());

  const [ticker, setTicker] = useState("");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");

  const [tokenMint, setTokenMint] = useState("");
  const [bagsUrl, setBagsUrl] = useState("");

  const setStep = useCallback(
    (step: Step, state: StepState) =>
      setStepStates((prev) => ({ ...prev, [step]: state })),
    []
  );

  useEffect(() => {
    fetchStory(storyId).then((s) => {
      if (!s) { router.push("/"); return; }
      setStory(s);
      if (s.coverImageUrl) setCoverPreview(s.coverImageUrl);
      if (authenticated && address) {
        setStep("wallet", { status: "done", detail: address.slice(0, 6) + "…" + address.slice(-4) });
        setCurrentStep("details");
      }
    });
  }, [storyId, router, setStep, authenticated, address]);

  async function handleConnectWallet() {
    setStep("wallet", { status: "loading" });
    try {
      const addr = await connect();
      setStep("wallet", { status: "done", detail: addr.slice(0, 6) + "…" + addr.slice(-4) });
      setCurrentStep("details");
    } catch (e: unknown) {
      setStep("wallet", { status: "error", detail: toMsg(e) });
    }
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setCoverPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim()) return;
    setStep("details", { status: "done", detail: ticker.toUpperCase() });
    setCurrentStep("launch");
    handleBagsLaunch();
  }

  async function handleBagsLaunch() {
    if (!story || !address) return;
    setStep("launch", { status: "loading" });
    try {
      // 1. Cover image — use stored URL if available, otherwise encode uploaded file
      let imageUrl: string | undefined = story.coverImageUrl;
      let imageBase64: string | undefined;
      if (!imageUrl && coverImage) {
        imageBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(coverImage);
        });
      }

      // 2. Create token info
      const infoRes = await fetch("/api/bags/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: story.title,
          symbol: ticker.toUpperCase(),
          description: story.description,
          imageUrl,
          imageBase64,
        }),
      });
      if (!infoRes.ok) throw new Error((await infoRes.json()).error ?? "Token info failed");
      const { tokenMint, tokenMetadata } = await infoRes.json();

      // 3. Create fee-share config (before launch)
      const feeRes = await fetch("/api/bags/fee-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payer: address,
          tokenMint,
          launchType: isSponsor ? "sponsor" : "author",
          authorWallet: isSponsor ? (story.authorWallet ?? address) : address,
          sponsorWallet: isSponsor ? address : undefined,
        }),
      });
      if (!feeRes.ok) throw new Error((await feeRes.json()).error ?? "Fee config failed");
      const { meteoraConfigKey, transactions: feeTxs } = await feeRes.json();

      // 4. Sign fee-share config transactions
      if (feeTxs?.length) await signAndSendAllBase64Txs(feeTxs);

      // 5. Create launch transaction
      const launchRes = await fetch("/api/bags/launch-txs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenMint,
          tokenMetadata,
          wallet: address,
          configKey: meteoraConfigKey,
        }),
      });
      if (!launchRes.ok) throw new Error((await launchRes.json()).error ?? "Launch failed");
      const { transaction: launchTx } = await launchRes.json();

      // 6. Sign + send launch transaction
      await signAndSendAllBase64Txs([launchTx]);

      // 7. Persist
      const listingUrl = `https://bags.fm/${tokenMint}?ref=sirhitalk`;
      setBagsUrl(listingUrl);
      setTokenMint(tokenMint);

      const updated: Story = {
        ...story,
        status: "tokenized",
        ticker: ticker.toUpperCase(),
        tokenMint,
        tokenListingUrl: listingUrl,
        launchType: isSponsor ? "sponsor" : "author",
        authorWallet: isSponsor ? (story.authorWallet ?? address) : address,
        sponsorWallet: isSponsor ? address : undefined,
      };
      await upsertStory(updated);
      setStory(updated);

      setStep("launch", { status: "done", detail: tokenMint.slice(0, 8) + "…" });
      setCurrentStep("done");
      setStep("done", { status: "done" });
    } catch (e: unknown) {
      setStep("launch", { status: "error", detail: toMsg(e) });
    }
  }

  if (!story) return null;

  const stepIdx = STEPS.indexOf(currentStep);
  const revenueInfo = isSponsor
    ? "Sponsor 0.50% · Author 0.25% · Platform 0.25%"
    : "Author 0.75% · Platform 0.25%";

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
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-1)" }}>
              {isSponsor ? "Sponsor & tokenize" : "Tokenize on Bags"}
            </h1>
            <p className="text-sm truncate max-w-xs" style={{ color: "var(--text-3)" }}>{story.title}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--amber)" }}>{revenueInfo} of trading fees</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-8">
          {STEPS.slice(0, -1).map((s, i) => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{
                background:
                  i < stepIdx
                    ? "linear-gradient(90deg, #00c6be, #ff6b9d)"
                    : i === stepIdx
                    ? "rgba(245,158,11,0.4)"
                    : "rgba(0,0,0,0.08)",
              }}
            />
          ))}
        </div>

        {/* Step list */}
        <div className="flex flex-col gap-3">
          {STEP_META.map((s, i) => {
            const state = stepStates[s.id];
            const isCurrent = s.id === currentStep && state.status !== "done";
            const isPast = state.status === "done";
            const isError = state.status === "error";
            const isLoading = state.status === "loading";

            return (
              <div
                key={s.id}
                className="p-4 rounded-2xl transition-colors"
                style={
                  isCurrent
                    ? { border: "1px solid rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.04)" }
                    : isPast
                    ? { border: "1px solid rgba(0,0,0,0.07)", background: "rgba(255,255,255,0.4)" }
                    : isError
                    ? { border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.04)" }
                    : { border: "1px solid rgba(0,0,0,0.05)", background: "rgba(255,255,255,0.25)" }
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={
                        isPast
                          ? { background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }
                          : isError
                          ? { background: "rgba(239,68,68,0.15)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.3)" }
                          : isCurrent
                          ? { background: "rgba(255,107,157,0.12)", color: "#ff6b9d", border: "1px solid rgba(255,107,157,0.3)" }
                          : { background: "rgba(0,0,0,0.05)", color: "var(--text-3)" }
                      }
                    >
                      {isPast ? "✓" : isError ? "!" : i + 1}
                    </div>
                    <div>
                      <p
                        className="text-sm font-medium"
                        style={{
                          color: isCurrent ? "var(--text-1)" : isPast ? "var(--text-3)" : "var(--text-3)",
                        }}
                      >
                        {s.label}
                      </p>
                      {state.detail && (
                        <p
                          className="text-xs mt-0.5 font-mono truncate max-w-xs"
                          style={{ color: isError ? "#dc2626" : "var(--text-3)" }}
                        >
                          {state.detail}
                        </p>
                      )}
                    </div>
                  </div>
                  {isLoading && (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: "var(--amber)" }} />
                  )}
                </div>

                {isCurrent && s.id === "wallet" && (
                  <button
                    onClick={handleConnectWallet}
                    className="mt-4 w-full py-2.5 rounded-xl font-semibold text-sm transition-colors"
                    style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
                  >
                    Connect wallet
                  </button>
                )}

                {isCurrent && s.id === "details" && (
                  <form onSubmit={handleDetailsSubmit} className="mt-4 flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>
                        Token ticker (3–10 chars)
                      </label>
                      <input
                        type="text"
                        value={ticker}
                        onChange={(e) =>
                          setTicker(
                            e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)
                          )
                        }
                        placeholder="STORY"
                        minLength={3}
                        maxLength={10}
                        required
                        className="w-full px-3 py-2.5 rounded-xl font-mono uppercase text-sm focus:outline-none transition-colors"
                        style={{
                          background: "rgba(255,255,255,0.7)",
                          border: "1px solid rgba(0,0,0,0.1)",
                          color: "var(--text-1)",
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>
                        Cover image{" "}
                        <span className="font-normal" style={{ color: "var(--text-3)" }}>(optional)</span>
                      </label>
                      <label
                        className="flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-colors"
                        style={{ border: "1px dashed rgba(0,0,0,0.15)", background: "rgba(255,255,255,0.5)" }}
                      >
                        {coverPreview ? (
                          <Image
                            src={coverPreview}
                            alt="Cover"
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center"
                            style={{ background: "rgba(0,0,0,0.06)" }}
                          >
                            <ImageIcon className="w-5 h-5" style={{ color: "var(--text-3)" }} />
                          </div>
                        )}
                        <span className="text-sm" style={{ color: "var(--text-2)" }}>
                          {coverImage ? coverImage.name : "Upload JPG or PNG"}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleCoverChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl font-semibold text-sm transition-colors"
                      style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
                    >
                      Launch on Bags →
                    </button>
                  </form>
                )}

                {isError && s.id === "launch" && (
                  <button
                    onClick={() => handleBagsLaunch()}
                    className="mt-4 w-full py-2 rounded-xl text-sm font-semibold transition-colors"
                    style={{ background: "rgba(239,68,68,0.12)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.2)" }}
                  >
                    Retry
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Done card */}
        {currentStep === "done" && (
          <div
            className="mt-6 p-6 rounded-2xl text-center"
            style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.3)" }}
          >
            <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--amber)" }} />
            <h2 className="text-lg font-bold mb-1" style={{ color: "var(--text-1)" }}>Token is live!</h2>
            <p className="text-sm mb-2" style={{ color: "var(--text-2)" }}>Your story is now trading on Bags App.</p>
            <p className="text-xs mb-5" style={{ color: "var(--amber)" }}>{revenueInfo} of all trading fees</p>
            <div className="flex flex-col gap-2">
              {bagsUrl && (
                <a
                  href={bagsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
                >
                  <ExternalLink className="w-4 h-4" /> Trade on Bags App
                </a>
              )}
              {tokenMint && (
                <p className="text-xs font-mono mt-1" style={{ color: "var(--text-3)" }}>Mint: {tokenMint}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
