"use client";

import Image from "next/image";
import { Loader2, Mail, WalletCards } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const {
    ready,
    authenticated,
    loginHelius,
    loginExternal,
    loginGoogle,
    googleEnabled,
    signingIn,
    error,
  } = useAuth();
  const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-3)" }} />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
        style={{ background: "var(--bg)", padding: "24px" }}>

        {/* bust decorations */}
        <Image src="/media/bust1.png" alt="" width={300} height={540}
          loading="eager"
          className="absolute bottom-0 left-0 pointer-events-none select-none"
          style={{ opacity: 0.05, filter: "saturate(0) contrast(1.1) invert(1)", transform: "scaleX(-1)", width: "auto" }} />
        <Image src="/media/bust2.png" alt="" width={300} height={540}
          className="absolute bottom-0 right-0 pointer-events-none select-none"
          style={{ opacity: 0.05, filter: "saturate(0) contrast(1.1) invert(1)", width: "auto" }} />

        {/* thin horizontal line accent */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

        <div className="w-full max-w-xs flex flex-col items-center gap-10 text-center relative z-10">
          {/* Logo */}
          <div className="flex flex-col items-center gap-4">
            <Image src="/media/logo-white.png" alt="Echoes" width={40} height={40}
              style={{ opacity: 0.7, filter: "grayscale(1)" }} />
            <div>
              <h1 className="text-5xl font-bold tracking-tight glitch"
                style={{ color: "#ededed", letterSpacing: "-0.04em" }}>
                echoes
              </h1>
              <p className="text-xs font-medium uppercase tracking-[0.3em] mt-2" style={{ color: "var(--text-3)" }}>
                records library
              </p>
            </div>
          </div>

          {/* Tagline */}
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
            Record your story. <span style={{ color: "var(--text-1)" }}>Get listed.</span> Tokenize and earn from every trade — forever.
          </p>

          {/* Stats row */}
          <div className="flex gap-8 w-full justify-center">
            {[
              { label: "Stories", value: "1.2K+" },
              { label: "Creators", value: "340+" },
              { label: "Volume", value: "$48K" },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <span className="text-base font-bold" style={{ color: "var(--text-1)" }}>{value}</span>
                <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-3)" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="w-full h-px" style={{ background: "rgba(255,255,255,0.07)" }} />

          {/* Wallet choices */}
          <div className="w-full flex flex-col gap-3">
            <button onClick={() => void loginExternal()} disabled={signingIn}
              className="btn-gold w-full py-4 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
              <WalletCards className="w-4 h-4" />
              {isAndroid ? "Seed Vault / mobile wallet" : "Phantom / Solflare"}
            </button>
            <button onClick={() => void loginHelius()} disabled={signingIn}
              className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ color: "var(--text-1)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {signingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Email or passkey
            </button>
            {googleEnabled && (
              <button onClick={() => void loginGoogle()} disabled={signingIn}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
                style={{ color: "var(--text-1)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                Continue with Google
              </button>
            )}
            {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
              Seed Vault and browser wallets sign directly. Email and passkey use a non-custodial Helius wallet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
