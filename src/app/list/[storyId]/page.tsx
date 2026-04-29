"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStory, saveStory } from "@/lib/store";
import { Story } from "@/lib/types";
import { connectWallet, getConnectedWallet } from "@/lib/wallet";
import { payListingFee } from "@/lib/echoes-payment";
import {
  ArrowLeft, Wallet, DollarSign, CheckCircle, Loader2, ExternalLink,
} from "lucide-react";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

type Step = "wallet" | "pay" | "done";

export default function ListPage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = use(params);
  const router = useRouter();

  const [story, setStory] = useState<Story | null>(null);
  const [step, setStep] = useState<Step>("wallet");
  const [wallet, setWallet] = useState<string | null>(null);
  const [txSig, setTxSig] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = getStory(storyId);
    if (!s) { router.push("/"); return; }

    // Already listed — skip straight to done
    if (s.status === "listed" || s.status === "tokenized") {
      setStory(s);
      setStep("done");
      return;
    }

    setStory(s);

    const addr = getConnectedWallet();
    if (addr) {
      setWallet(addr);
      setStep("pay");
    }
  }, [storyId, router]);

  async function handleConnect() {
    setLoading(true);
    try {
      const addr = await connectWallet();
      setWallet(addr);
      setStep("pay");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  async function handlePay() {
    if (!wallet || !story) return;
    setLoading(true);
    setError("");
    try {
      const sig = await payListingFee(wallet, RPC_URL);
      setTxSig(sig);

      const updated: Story = {
        ...story,
        status: "listed",
        authorWallet: wallet,
        listingTxSig: sig,
      };
      saveStory(updated);
      setStory(updated);
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  }

  if (!story) return null;

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
            <h1 className="text-2xl font-bold">List your story</h1>
            <p className="text-sm text-neutral-500 truncate max-w-xs">{story.title}</p>
          </div>
        </div>

        {/* What happens after listing */}
        <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 mb-8">
          <p className="text-sm font-medium text-neutral-300 mb-3">After listing your story:</p>
          <ul className="flex flex-col gap-2 text-sm text-neutral-400">
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">✓</span>
              Visible to everyone in the Records Library
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">✓</span>
              Enters the weekly $ECHOES vote pool
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">✓</span>
              Others can listen and evaluate it
            </li>
            <li className="flex items-start gap-2">
              <span className="text-neutral-600 mt-0.5">→</span>
              <span className="text-neutral-500">
                Optionally tokenize later (Arweave + Bags App) to earn 75% of trading volume
              </span>
            </li>
          </ul>
        </div>

        {/* Step: Connect wallet */}
        {step === "wallet" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 p-5 rounded-2xl bg-neutral-900 border border-amber-500">
              <Wallet className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">Connect Phantom</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Needed to sign the $1 $ECHOES payment
                </p>
              </div>
            </div>
            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black rounded-xl font-semibold transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Connecting…
                </span>
              ) : (
                "Connect Phantom"
              )}
            </button>
          </div>
        )}

        {/* Step: Pay */}
        {step === "pay" && (
          <div className="flex flex-col gap-4">
            <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <p className="font-semibold text-sm">Listing fee</p>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-neutral-400">Amount</span>
                <span className="font-mono text-white font-medium">$1 in $ECHOES</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-neutral-400">Recipient</span>
                <span className="font-mono text-neutral-500 text-xs">
                  7PfDfuoN…kNhB
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-neutral-800 pt-3 mt-3">
                <span className="text-neutral-400">From</span>
                <span className="font-mono text-neutral-300 text-xs">
                  {wallet?.slice(0, 6)}…{wallet?.slice(-4)}
                </span>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-xl p-3">
                {error}
              </p>
            )}

            <button
              onClick={handlePay}
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black rounded-xl font-semibold transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Paying…
                </span>
              ) : (
                "Pay $1 $ECHOES — list my story"
              )}
            </button>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="flex flex-col gap-4">
            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500 text-center">
              <CheckCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <h2 className="text-lg font-bold mb-1">Story is live! 🎉</h2>
              <p className="text-sm text-neutral-400 mt-1">
                Your story is now public and entered in the weekly $ECHOES vote pool.
              </p>
              {txSig && (
                <a
                  href={`https://solscan.io/tx/${txSig}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> View transaction
                </a>
              )}
            </div>

            {/* Next step: optional tokenization */}
            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
              <p className="text-sm font-medium text-neutral-300 mb-2">Want to earn trading fees?</p>
              <p className="text-xs text-neutral-500 mb-4">
                Tokenize your story on Bags App — upload to Arweave permanently
                and launch a tradeable token. You earn <span className="text-amber-400">0.75% of all trading volume</span> forever.
              </p>
              <Link
                href={`/tokenize/${storyId}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Tokenize on Bags App →
              </Link>
            </div>

            <Link
              href="/"
              className="flex items-center justify-center gap-2 w-full py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-semibold transition-colors"
            >
              Back to Library
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
