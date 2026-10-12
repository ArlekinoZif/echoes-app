import { runtimeEnv } from "@/lib/runtime-env";

/**
 * Returns an absolute Solana RPC URL safe for `new Connection()`.
 * NEXT_PUBLIC_SOLANA_RPC_URL may be a relative path ("/api/rpc") when
 * proxied through Next.js — Connection requires an absolute http(s) URL.
 */
export function getRpcUrl(): string {
  const raw = runtimeEnv("NEXT_PUBLIC_SOLANA_RPC_URL") ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "";
  if (!raw || raw.startsWith("http")) return raw || "https://api.mainnet-beta.solana.com";
  // relative path — prepend origin (browser only; on server use absolute fallback)
  if (typeof window !== "undefined") return `${window.location.origin}${raw}`;
  // SSR: proxy isn't needed server-side, use direct URL from server env
  return runtimeEnv("SOLANA_RPC_URL") ?? "https://solana-mainnet.g.alchemy.com/v2/demo";
}
