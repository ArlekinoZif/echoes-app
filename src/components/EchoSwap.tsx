"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowDown, Loader2, CheckCircle, X, TrendingUp, Zap, ExternalLink } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const ECHO_MINT = process.env.NEXT_PUBLIC_ECHOES_TOKEN_MINT ?? "8F2N1Da9z1arxiFKmTzxaKoX1yUjJ2xKFQBxxMjQBAGS";
const LAMPORTS = 1_000_000_000;

type SwapState = "idle" | "quoting" | "ready" | "signing" | "confirmed" | "error";

type SwapVenue = "jupiter" | "bags";

interface QuoteResult {
  outAmount: string;     // $ECHO lamports (usually 9 decimals)
  priceImpactPct: string;
  routePlan: unknown[];
  raw: unknown;
  venue: SwapVenue;
}

const BAGS_TOKEN_URL = `https://bags.fm/${ECHO_MINT}`;

function isNoRoute(message: string) {
  const m = message.toLowerCase();
  return m.includes("not tradable") || m.includes("no route") || m.includes("route not found");
}

function fmtSol(n: number) { return n.toLocaleString("en", { maximumFractionDigits: 4 }); }
function fmtEcho(lamports: string, decimals = 9) {
  const n = Number(lamports) / 10 ** decimals;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toFixed(2);
}

interface Props { onClose: () => void; }

export default function EchoSwap({ onClose }: Props) {
  const { address, signAndSendAllBase64Txs } = useWallet();
  const [solAmount, setSolAmount] = useState("0.1");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [state, setState] = useState<SwapState>("idle");
  const [error, setError] = useState("");
  const [txSig, setTxSig] = useState("");
  const [echoPrice, setEchoPrice] = useState<number | null>(null);
  const [offDexOnly, setOffDexOnly] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Fetch $ECHO price once
  useEffect(() => {
    authenticatedFetch("/api/echoes-price").then(r => r.json()).then(d => {
      if (d.price) setEchoPrice(d.price);
    }).catch(() => {});
  }, []);

  const fetchQuote = useCallback(async (sol: string) => {
    const num = parseFloat(sol);
    if (!num || num <= 0) { setQuote(null); setState("idle"); return; }
    setState("quoting");
    setError("");
    setOffDexOnly(false);
    try {
      const lamports = Math.round(num * LAMPORTS);
      const query = `inputMint=${SOL_MINT}&outputMint=${ECHO_MINT}&amount=${lamports}&slippage=100`;

      // Jupiter first; Bags is the venue that lists a story token before it
      // reaches a public DEX route.
      let venue: SwapVenue = "jupiter";
      let res = await authenticatedFetch(`/api/jupiter-swap?action=quote&${query}`);
      let data = await res.json();

      if (data.error || !data.outAmount) {
        venue = "bags";
        res = await authenticatedFetch(`/api/bags-swap?action=quote&${query}`);
        data = await res.json();
      }

      if (data.error || !data.outAmount) {
        setState("error");
        const raw = (data.error ?? "") as string;
        const noRoute = isNoRoute(raw) || !data.outAmount;
        setOffDexOnly(noRoute);
        setError(
          noRoute
            ? "$ECHO isn't on a DEX route yet — buy it directly on Bags below."
            : raw || "No route found for this amount"
        );
        setQuote(null);
        return;
      }

      setQuote({
        outAmount: data.outAmount,
        priceImpactPct: data.priceImpactPct,
        routePlan: data.routePlan ?? [],
        raw: data,
        venue,
      });
      setState("ready");
    } catch {
      setState("error");
      setError("Failed to fetch quote. Check your connection.");
    }
  }, []);

  // Debounce input
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchQuote(solAmount), 600);
    return () => clearTimeout(debounceRef.current);
  }, [solAmount, fetchQuote]);

  async function executeSwap() {
    if (!quote || !address) return;
    setState("signing");
    setError("");
    try {
      // Build swap tx on server (keeps API key server-side)
      const res = await authenticatedFetch(quote.venue === "bags" ? "/api/bags-swap" : "/api/jupiter-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteResponse: quote.raw, userPublicKey: address }),
      });
      const { swapTransaction, error: apiErr } = await res.json();
      if (apiErr || !swapTransaction) throw new Error(apiErr ?? "No swap transaction returned");

      const [sig] = await signAndSendAllBase64Txs([swapTransaction]);
      setTxSig(sig);
      setState("confirmed");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("cancel") ? "Transaction cancelled." : msg);
      setState("error");
    }
  }

  const solNum = parseFloat(solAmount) || 0;
  const usdValue = echoPrice && quote ? (Number(quote.outAmount) / 1e9) * echoPrice : null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center px-4 pb-6"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-2xl flex flex-col gap-0 overflow-hidden"
        style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 80px rgba(0,0,0,0.8)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: "#c8a84b" }} />
            <span className="font-bold text-sm" style={{ color: "#ededed" }}>Buy $ECHO</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: "var(--text-3)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Confirmed state */}
        {state === "confirmed" ? (
          <div className="flex flex-col items-center gap-4 px-5 py-10 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <CheckCircle className="w-7 h-7" style={{ color: "#ededed" }} />
            </div>
            <div>
              <p className="font-bold text-base" style={{ color: "#ededed" }}>Swap complete!</p>
              <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>
                {fmtEcho(quote?.outAmount ?? "0")} $ECHO received
              </p>
            </div>
            {txSig && (
              <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
                className="text-xs underline" style={{ color: "var(--text-3)" }}>
                View on Solscan
              </a>
            )}
            <button onClick={onClose}
              className="btn-gold w-full py-3 rounded-xl font-semibold text-sm">
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-5">
            {/* You pay */}
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: "var(--text-3)" }}>You pay</span>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <span className="text-xs font-semibold" style={{ color: "#ededed" }}>SOL</span>
                </div>
              </div>
              <input
                type="number" min="0.001" step="0.01"
                value={solAmount}
                onChange={e => setSolAmount(e.target.value)}
                className="w-full bg-transparent text-2xl font-bold outline-none tabular-nums"
                style={{ color: "#ededed" }}
                placeholder="0.0"
              />
              {echoPrice && solNum > 0 && (
                <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
                  ≈ ${(solNum * (echoPrice > 0 ? solNum / (quote ? Number(quote.outAmount) / 1e9 / solNum : 1) : 0)).toFixed(2)} USD
                </p>
              )}
            </div>

            {/* Arrow */}
            <div className="flex justify-center -my-1">
              <div className="p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <ArrowDown className="w-4 h-4" style={{ color: "var(--text-3)" }} />
              </div>
            </div>

            {/* You receive */}
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: "var(--text-3)" }}>You receive</span>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.2)" }}>
                  <span className="text-xs font-semibold" style={{ color: "#c8a84b" }}>$ECHO</span>
                </div>
              </div>
              <div className="text-2xl font-bold tabular-nums" style={{ color: state === "quoting" ? "var(--text-3)" : "#ededed" }}>
                {state === "quoting" ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-3)" }} />
                    <span className="text-base" style={{ color: "var(--text-3)" }}>Fetching quote…</span>
                  </span>
                ) : quote ? (
                  fmtEcho(quote.outAmount)
                ) : (
                  <span style={{ color: "var(--text-3)" }}>—</span>
                )}
              </div>
              {usdValue !== null && (
                <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>≈ ${usdValue.toFixed(2)} USD</p>
              )}
            </div>

            {/* Price impact */}
            {quote && parseFloat(quote.priceImpactPct) > 0.5 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "rgba(245,200,66,0.06)", border: "1px solid rgba(245,200,66,0.2)" }}>
                <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#c8a84b" }} />
                <span className="text-xs" style={{ color: "#c8a84b" }}>
                  Price impact: {parseFloat(quote.priceImpactPct).toFixed(2)}%
                </span>
              </div>
            )}

            {/* Error */}
            {state === "error" && error && (
              <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                {error}
              </div>
            )}

            {/* A token with no DEX route can still be bought on its launch venue. */}
            {offDexOnly && (
              <a
                href={BAGS_TOKEN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Buy $ECHO on Bags
              </a>
            )}

            {/* Action */}
            {!address ? (
              <div className="text-center text-sm py-2" style={{ color: "var(--text-3)" }}>
                Connect your wallet to swap
              </div>
            ) : (
              <button
                onClick={executeSwap}
                disabled={state !== "ready" || !quote}
                className="btn-gold w-full py-4 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                {state === "signing" ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Confirm in wallet…
                  </span>
                ) : state === "quoting" ? "Fetching best price…"
                  : state === "error" ? "Retry"
                  : `Swap ${fmtSol(solNum)} SOL → ${quote ? fmtEcho(quote.outAmount) : "…"} $ECHO`}
              </button>
            )}

            <p className="text-center text-xs" style={{ color: "var(--text-3)" }}>
              Powered by Jupiter • 1% slippage
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
