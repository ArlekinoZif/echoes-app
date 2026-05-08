"use client";

import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useCreateWallet } from "@privy-io/react-auth/solana";
import { Loader2 } from "lucide-react";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();

  // Silently create embedded wallet in the background after login
  useEffect(() => {
    if (authenticated && wallets.length === 0) {
      createWallet().catch(() => {});
    }
  }, [authenticated, wallets.length, createWallet]);

  if (!ready) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-3)" }} />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ padding: "24px", background: "var(--bg)" }}
      >
        <div className="w-full max-w-xs flex flex-col items-center gap-6 text-center">
          <div className="flex flex-col items-center gap-1">
            <h1
              className="text-4xl font-bold tracking-tight"
              style={{
                background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                letterSpacing: "-0.03em",
              }}
            >
              echoes
            </h1>
            <p
              className="text-xs font-medium uppercase tracking-widest"
              style={{ color: "var(--text-3)" }}
            >
              records library
            </p>
          </div>

          <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
            Record your story. Get listed. Tokenize and earn from every trade — forever.
          </p>

          <button
            onClick={login}
            className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)",
              color: "#fff",
            }}
          >
            Sign in to continue
          </button>

          <p className="text-xs" style={{ color: "var(--text-3)" }}>
            Email, Google, X — or connect your wallet
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
