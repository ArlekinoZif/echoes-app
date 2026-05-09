"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchStory, upsertStory } from "@/lib/db";
import { Story } from "@/lib/types";
import { useWallet } from "@/hooks/useWallet";
import { payListingFee } from "@/lib/echoes-payment";
import {
  ArrowLeft, Wallet, DollarSign, CheckCircle, Loader2, ExternalLink, Copy,
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

  const { authenticated, address, connect, signAndSendAllBase64Txs } = useWallet();

  const [story, setStory] = useState<Story | null>(null);
  const [step, setStep] = useState<Step>("wallet");
  const [txSig, setTxSig] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTopUp, setShowTopUp] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchStory(storyId).then((s) => {
      if (!s) { router.push("/"); return; }
      if (s.status === "listed" || s.status === "tokenized") {
        setStory(s);
        setStep("done");
        return;
      }
      setStory(s);
      if (authenticated && address) setStep("pay");
    });
  }, [storyId, router, authenticated, address]);

  async function handleConnect() {
    setLoading(true);
    try {
      await connect();
      setStep("pay");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  async function handlePay() {
    if (!address || !story) return;
    setLoading(true);
    setError("");
    try {
      const sig = await payListingFee(address, RPC_URL, signAndSendAllBase64Txs);
      setShowTopUp(false);
      setTxSig(sig);

      const updated: Story = {
        ...story,
        status: "listed",
        authorWallet: address,
        listingTxSig: sig,
      };
      await upsertStory(updated);
      setStory(updated);
      setStep("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Payment failed";
      setError(msg);
      if (
        msg.toLowerCase().includes("insufficient") ||
        msg.toLowerCase().includes("balance") ||
        msg.toLowerCase().includes("funds") ||
        msg.toLowerCase().includes("0x1")
      ) {
        setShowTopUp(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!story) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <Link
            href="/"
            className="p-2 rounded-full transition-colors"
            style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.07)", color: "var(--text-2)" }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-1)" }}>List your story</h1>
            <p className="text-sm truncate max-w-xs" style={{ color: "var(--text-3)" }}>{story.title}</p>
          </div>
        </div>

        {/* What happens after listing */}
        <div className="glass p-4 rounded-2xl mb-8">
          <p className="text-sm font-medium mb-3" style={{ color: "var(--text-2)" }}>After listing your story:</p>
          <ul className="flex flex-col gap-2 text-sm" style={{ color: "var(--text-2)" }}>
            <li className="flex items-start gap-2">
              <span className="mt-0.5" style={{ color: "var(--amber)" }}>✓</span>
              Visible to everyone in the Records Library
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5" style={{ color: "var(--amber)" }}>✓</span>
              Enters the weekly $ECHOES vote pool
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5" style={{ color: "var(--amber)" }}>✓</span>
              Others can listen and evaluate it
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5" style={{ color: "var(--text-3)" }}>→</span>
              <span style={{ color: "var(--text-3)" }}>
                Optionally tokenize later (Bags App) to earn 0.75% of all trading fees
              </span>
            </li>
          </ul>
        </div>

        {/* Step: Connect wallet */}
        {step === "wallet" && (
          <div className="flex flex-col gap-4">
            <div
              className="flex items-center gap-3 p-5 rounded-2xl"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.3)" }}
            >
              <Wallet className="w-5 h-5 flex-shrink-0" style={{ color: "var(--amber)" }} />
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text-1)" }}>Connect wallet</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                  Needed to sign the $1 $ECHOES payment
                </p>
              </div>
            </div>
            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Connecting…
                </span>
              ) : (
                "Connect wallet"
              )}
            </button>
          </div>
        )}

        {/* Step: Pay */}
        {step === "pay" && (
          <div className="flex flex-col gap-4">
            <div className="glass p-5 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-4 h-4" style={{ color: "var(--amber)" }} />
                <p className="font-semibold text-sm" style={{ color: "var(--text-1)" }}>Listing fee</p>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span style={{ color: "var(--text-3)" }}>Amount</span>
                <span className="font-mono font-medium" style={{ color: "var(--text-1)" }}>$1 in $ECHOES</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span style={{ color: "var(--text-3)" }}>Recipient</span>
                <span className="font-mono text-xs" style={{ color: "var(--text-3)" }}>
                  7PfDfuoN…kNhB
                </span>
              </div>
              <div
                className="flex justify-between text-sm pt-3 mt-3"
                style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }}
              >
                <span style={{ color: "var(--text-3)" }}>From</span>
                <span className="font-mono text-xs" style={{ color: "var(--text-2)" }}>
                  {address?.slice(0, 6)}…{address?.slice(-4)}
                </span>
              </div>
            </div>

            {error && (
              <p
                className="text-sm p-3 rounded-xl"
                style={{ color: "#dc2626", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                {error}
              </p>
            )}

            {showTopUp && address && (
              <div
                className="flex flex-col gap-3 p-4 rounded-2xl"
                style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.3)" }}
              >
                <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                  Top up your wallet with $ECHOES
                </p>
                <p className="text-xs" style={{ color: "var(--text-2)" }}>
                  You need at least $1 worth of $ECHOES tokens. Send them to your wallet address below.
                </p>

                {/* Wallet address row */}
                <div
                  className="flex items-center gap-2 p-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.07)" }}
                >
                  <span className="flex-1 font-mono text-xs truncate" style={{ color: "var(--text-2)" }}>
                    {address}
                  </span>
                  <button
                    onClick={handleCopyAddress}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium flex-shrink-0 transition-colors"
                    style={
                      copied
                        ? { background: "rgba(255,107,157,0.15)", color: "#ff6b9d" }
                        : { background: "rgba(0,0,0,0.05)", color: "var(--text-2)" }
                    }
                  >
                    <Copy className="w-3 h-3" />
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>

                <a
                  href="https://bags.fm/?ref=echoesfans"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
                >
                  <ExternalLink className="w-3 h-3" /> Get $ECHOES on Bags App
                </a>
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Paying…
                </span>
              ) : (
                "Pay 2400 $ECHOES — list my story"
              )}
            </button>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="flex flex-col gap-4">
            <div
              className="p-6 rounded-2xl text-center"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.3)" }}
            >
              <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--amber)" }} />
              <h2 className="text-lg font-bold mb-1" style={{ color: "var(--text-1)" }}>Story is live!</h2>
              <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
                Your story is now public and entered in the weekly $ECHOES vote pool.
              </p>
              {txSig && (
                <a
                  href={`https://solscan.io/tx/${txSig}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-xs transition-colors"
                  style={{ color: "var(--text-3)" }}
                >
                  <ExternalLink className="w-3 h-3" /> View transaction
                </a>
              )}
            </div>

            {/* Next step: optional tokenization */}
            <div className="glass p-4 rounded-2xl">
              <p className="text-sm font-medium mb-2" style={{ color: "var(--text-1)" }}>Want to earn trading fees?</p>
              <p className="text-xs mb-4" style={{ color: "var(--text-2)" }}>
                Tokenize your story on Bags App — launch a tradeable token and earn{" "}
                <span style={{ color: "var(--amber)" }}>0.75% of all trading fees</span> forever.
              </p>
              <Link
                href={`/tokenize/${storyId}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: "rgba(0,0,0,0.06)", color: "var(--text-1)", border: "1px solid rgba(0,0,0,0.07)" }}
              >
                Tokenize on Bags App →
              </Link>
            </div>

            <Link
              href="/"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold transition-colors"
              style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)", color: "#fff" }}
            >
              Back to Library
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
