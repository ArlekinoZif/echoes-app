"use client";

import { use, useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getStory, saveStory } from "@/lib/store";
import { Story } from "@/lib/types";
import { connectWallet, getConnectedWallet, signAndSendAllBase64Txs } from "@/lib/wallet";
import { uploadToArweave } from "@/lib/arweave";
import { payListingFee } from "@/lib/echoes-payment";
import {
  ArrowLeft,
  Wallet,
  Upload,
  Zap,
  CheckCircle,
  ExternalLink,
  Loader2,
  ImageIcon,
  DollarSign,
} from "lucide-react";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

type Step =
  | "wallet"    // connect Phantom
  | "details"   // ticker + cover image
  | "pay"       // $1 ECHOES listing fee
  | "upload"    // Arweave audio upload
  | "launch"    // Bags token creation + fee-share
  | "done";

type StepStatus = "idle" | "loading" | "done" | "error";

interface StepState {
  status: StepStatus;
  detail?: string;
}

const STEP_META: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: "wallet", label: "Connect wallet", icon: <Wallet className="w-4 h-4" /> },
  { id: "details", label: "Token details", icon: <ImageIcon className="w-4 h-4" /> },
  { id: "pay", label: "Pay listing fee ($1 ECHOES)", icon: <DollarSign className="w-4 h-4" /> },
  { id: "upload", label: "Upload to Arweave", icon: <Upload className="w-4 h-4" /> },
  { id: "launch", label: "Launch on Bags App", icon: <Zap className="w-4 h-4" /> },
  { id: "done", label: "Done!", icon: <CheckCircle className="w-4 h-4" /> },
];

const STEPS = STEP_META.map((s) => s.id);

function initStates(): Record<Step, StepState> {
  return Object.fromEntries(STEPS.map((s) => [s, { status: "idle" }])) as Record<
    Step,
    StepState
  >;
}

export default function TokenizePage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = use(params);
  const router = useRouter();

  const [story, setStory] = useState<Story | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>("wallet");
  const [stepStates, setStepStates] = useState<Record<Step, StepState>>(initStates());
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Details form state
  const [ticker, setTicker] = useState("");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>("");

  // Results
  const [arweaveUrl, setArweaveUrl] = useState("");
  const [tokenMint, setTokenMint] = useState("");
  const [bagsUrl, setBagsUrl] = useState("");
  const [listingTxSig, setListingTxSig] = useState("");

  const audioBlobRef = useRef<Blob | null>(null);

  const setStep = useCallback((step: Step, state: StepState) =>
    setStepStates((prev) => ({ ...prev, [step]: state })), []);

  // Load story + prefetch audio
  useEffect(() => {
    const s = getStory(storyId);
    if (!s) { router.push("/"); return; }
    setStory(s);

    fetch(s.audioBlobUrl)
      .then((r) => r.blob())
      .then((b) => { audioBlobRef.current = b; })
      .catch(console.warn);

    // Auto-connect if already connected
    const addr = getConnectedWallet();
    if (addr) {
      setWalletAddress(addr);
      setStep("wallet", { status: "done", detail: addr.slice(0, 6) + "…" + addr.slice(-4) });
      setCurrentStep("details");
    }
  }, [storyId, router, setStep]);

  // ── Step handlers ─────────────────────────────────────────────────────────

  async function handleConnectWallet() {
    setStep("wallet", { status: "loading" });
    try {
      const addr = await connectWallet();
      setWalletAddress(addr);
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
    setCurrentStep("pay");
  }

  async function handlePayFee() {
    if (!walletAddress) return;
    setStep("pay", { status: "loading" });
    try {
      const sig = await payListingFee(walletAddress, RPC_URL);
      setListingTxSig(sig);
      setStep("pay", { status: "done", detail: sig.slice(0, 8) + "…" });
      setCurrentStep("upload");
      await handleArweaveUpload();
    } catch (e: unknown) {
      setStep("pay", { status: "error", detail: toMsg(e) });
    }
  }

  async function handleArweaveUpload() {
    if (!story || !audioBlobRef.current) return;
    setStep("upload", { status: "loading" });
    try {
      const result = await uploadToArweave(audioBlobRef.current, {
        title: story.title,
        description: story.description,
        category: story.category,
      });
      setArweaveUrl(result.url);
      setStep("upload", { status: "done", detail: result.id.slice(0, 10) + "…" });
      setCurrentStep("launch");
      await handleBagsLaunch(result.url);
    } catch (e: unknown) {
      setStep("upload", { status: "error", detail: toMsg(e) });
    }
  }

  async function handleBagsLaunch(arwaveAudioUrl: string) {
    if (!story || !walletAddress) return;
    setStep("launch", { status: "loading" });
    try {
      // 1. Prepare cover image (base64 or skip)
      let imageBase64: string | undefined;
      if (coverImage) {
        imageBase64 = await fileToBase64(coverImage);
      }

      // 2. Create token info (server-side)
      const infoRes = await fetch("/api/bags/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: story.title,
          symbol: ticker.toUpperCase(),
          description: story.description,
          imageBase64,
          arweaveUrl: arwaveAudioUrl,
        }),
      });
      if (!infoRes.ok) throw new Error((await infoRes.json()).error ?? "Token info failed");
      const { tokenInfoId } = await infoRes.json();

      // 3. Get launch transactions (server-side)
      const launchRes = await fetch("/api/bags/launch-txs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenInfoId, creatorWallet: walletAddress }),
      });
      if (!launchRes.ok) throw new Error((await launchRes.json()).error ?? "Launch failed");
      const { transactions: launchTxs, mint } = await launchRes.json();

      // 4. Sign + send launch transactions (client-side, Phantom)
      await signAndSendAllBase64Txs(launchTxs, RPC_URL);
      const resolvedMint: string = mint || tokenInfoId; // fallback if mint not yet returned

      // 5. Get fee-share transactions (server-side)
      const feeRes = await fetch("/api/bags/fee-share-txs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint: resolvedMint,
          launchType: "author",
          authorWallet: walletAddress,
        }),
      });
      if (!feeRes.ok) throw new Error((await feeRes.json()).error ?? "Fee-share failed");
      const { transactions: feeTxs } = await feeRes.json();

      // 6. Sign + send fee-share transactions
      if (feeTxs?.length) {
        await signAndSendAllBase64Txs(feeTxs, RPC_URL);
      }

      // 7. Persist updated story
      const listingUrl = `https://bags.fm/token/${resolvedMint}?ref=sirhitalk`;
      setBagsUrl(listingUrl);
      setTokenMint(resolvedMint);

      const updated: Story = {
        ...story,
        status: "tokenized",
        ticker: ticker.toUpperCase(),
        tokenMint: resolvedMint,
        tokenListingUrl: listingUrl,
        launchType: "author",
        authorWallet: walletAddress,
        arweaveCid: arwaveAudioUrl,
        listingTxSig,
      };
      saveStory(updated);
      setStory(updated);

      setStep("launch", { status: "done", detail: resolvedMint.slice(0, 8) + "…" });
      setCurrentStep("done");
      setStep("done", { status: "done" });
    } catch (e: unknown) {
      setStep("launch", { status: "error", detail: toMsg(e) });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function toMsg(e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  if (!story) return null;

  const stepIdx = STEPS.indexOf(currentStep);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/"
            className="p-2 rounded-full hover:bg-neutral-800 transition-colors text-neutral-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Tokenize story</h1>
            <p className="text-sm text-neutral-500 truncate max-w-xs">
              {story.title}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-8">
          {STEPS.slice(0, -1).map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < stepIdx
                  ? "bg-amber-500"
                  : i === stepIdx
                  ? "bg-amber-500/50"
                  : "bg-neutral-800"
              }`}
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
                {/* Row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
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
                      <p
                        className={`text-sm font-medium ${
                          isCurrent
                            ? "text-white"
                            : isPast
                            ? "text-neutral-400"
                            : "text-neutral-600"
                        }`}
                      >
                        {s.label}
                      </p>
                      {state.detail && (
                        <p
                          className={`text-xs mt-0.5 font-mono truncate max-w-xs ${
                            isError ? "text-red-400" : "text-neutral-500"
                          }`}
                        >
                          {state.detail}
                        </p>
                      )}
                    </div>
                  </div>
                  {isLoading && (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                  )}
                </div>

                {/* ── Step-specific actions ─────────────────────────────── */}

                {/* Wallet */}
                {isCurrent && s.id === "wallet" && (
                  <button
                    onClick={handleConnectWallet}
                    className="mt-4 w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-semibold text-sm transition-colors"
                  >
                    Connect Phantom
                  </button>
                )}

                {/* Details */}
                {isCurrent && s.id === "details" && (
                  <form onSubmit={handleDetailsSubmit} className="mt-4 flex flex-col gap-4">
                    {/* Ticker */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-400 mb-1">
                        Token ticker (3–10 chars)
                      </label>
                      <input
                        type="text"
                        value={ticker}
                        onChange={(e) =>
                          setTicker(
                            e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, "")
                              .slice(0, 10)
                          )
                        }
                        placeholder="STORY"
                        minLength={3}
                        maxLength={10}
                        required
                        className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 font-mono uppercase transition-colors"
                      />
                    </div>

                    {/* Cover image (optional) */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-400 mb-1">
                        Cover image{" "}
                        <span className="text-neutral-600 font-normal">(optional, shown on Bags)</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-dashed border-neutral-700 hover:border-neutral-500 transition-colors">
                        {coverPreview ? (
                          <Image
                            src={coverPreview}
                            alt="Cover"
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-neutral-800 flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-neutral-600" />
                          </div>
                        )}
                        <span className="text-sm text-neutral-500">
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
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-semibold text-sm transition-colors"
                    >
                      Continue
                    </button>
                  </form>
                )}

                {/* Pay */}
                {isCurrent && s.id === "pay" && (
                  <div className="mt-4">
                    <p className="text-xs text-neutral-400 mb-3">
                      Transfer $1 worth of $ECHOES tokens to the platform
                      wallet to list your story. This unlocks tokenization.
                    </p>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-neutral-400">Listing fee</span>
                      <span className="font-mono text-white">$1 in ECHOES</span>
                    </div>
                    <div className="flex justify-between text-sm mb-4">
                      <span className="text-neutral-400">Revenue share (you)</span>
                      <span className="font-mono text-amber-400">75 %</span>
                    </div>
                    <button
                      onClick={handlePayFee}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-semibold text-sm transition-colors"
                    >
                      Pay with Phantom
                    </button>
                  </div>
                )}

                {/* Upload / Launch: auto-triggered, no button shown */}
                {isError && (s.id === "upload" || s.id === "launch") && (
                  <button
                    onClick={
                      s.id === "upload"
                        ? () => handleArweaveUpload()
                        : () => handleBagsLaunch(arweaveUrl)
                    }
                    className="mt-4 w-full py-2 bg-red-800 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors"
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
          <div className="mt-6 p-6 rounded-2xl bg-amber-500/10 border border-amber-500 text-center">
            <CheckCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold mb-1">Your story is live! 🎉</h2>
            <p className="text-sm text-neutral-400 mb-5">
              Preserved forever on Arweave. Trading on Bags App now.
              You earn 75% of all trading volume.
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
              {tokenMint && (
                <p className="text-xs text-neutral-600 font-mono mt-1">
                  Mint: {tokenMint}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
