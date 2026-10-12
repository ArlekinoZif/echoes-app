"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { BookOpen, Mic, User, Zap } from "lucide-react";
import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";

// Heavy @solana/web3.js graphs — loaded only when needed, so they stay out of
// the global layout bundle that every route compiles against.
const EchoBalance = dynamic(() => import("@/components/EchoBalance"), {
  ssr: false,
  loading: () => <div className="h-3 w-14 rounded animate-pulse" style={{ background: "rgba(200,168,75,0.15)" }} />,
});
const EchoSwap = dynamic(() => import("@/components/EchoSwap"), { ssr: false });

const NAV = [
  { href: "/", icon: BookOpen, label: "Explore" },
  { href: "/record", icon: Mic, label: "Record" },
  { href: "/zone", icon: User, label: "Profile" },
] as const;

const HIDDEN_ON = ["/record", "/evaluate/", "/list/", "/vote"];

export default function NavBar() {
  const pathname = usePathname();
  const { address, provider } = useWallet();
  const [swapOpen, setSwapOpen] = useState(false);

  const hiddenMobile = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(p));

  const echoBtn = address ? (
    <button
      onClick={() => setSwapOpen(true)}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all active:scale-95"
      style={{ background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.15)" }}
      title="Buy $ECHO">
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#c8a84b" }} />
      <EchoBalance address={address} />
    </button>
  ) : (
    <button
      onClick={() => setSwapOpen(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-2)" }}>
      <Zap className="w-3 h-3" /> Buy $ECHO
    </button>
  );

  return (
    <>
      {/* ══════════════════════════════════════
          MOBILE — top header + bottom nav
          ══════════════════════════════════════ */}

      {/* Top header (mobile only) */}
      <header className="lg:hidden" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        height: "56px",
        background: "rgba(12,12,12,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        <div className="max-w-xl mx-auto px-4 h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/media/logo-white.png" alt="Echoes" width={22} height={22}
              style={{ opacity: 0.8, filter: "grayscale(1)" }} />
            <span className="text-sm font-bold tracking-tight" style={{ color: "#ededed", letterSpacing: "-0.02em" }}>
              echoes
            </span>
          </Link>
          {echoBtn}
        </div>
      </header>

      {/* Bottom nav (mobile only, hidden on certain pages) */}
      {!hiddenMobile && (
        <nav className="lg:hidden" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50 }}>
          <div className="max-w-xs mx-auto mb-5 px-2">
            <div className="flex items-center rounded-xl overflow-hidden"
              style={{
                background: "rgba(17,17,17,0.95)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
              }}>
              {NAV.map(({ href, icon: Icon, label }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                const isRecord = label === "Record";

                return (
                  <Link key={href} href={href}
                    className="flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all relative">
                    {isRecord ? (
                      <div className="btn-gold w-9 h-9 rounded-lg flex items-center justify-center transition-transform active:scale-90">
                        <Icon className="w-4 h-4" style={{ color: "#0c0c0c" }} strokeWidth={2.5} />
                      </div>
                    ) : (
                      <Icon className="w-5 h-5 transition-colors"
                        style={{ color: active ? "#ededed" : "rgba(255,255,255,0.2)" }}
                        strokeWidth={active ? 2 : 1.5} />
                    )}
                    <span className="text-[9px] font-semibold uppercase tracking-widest transition-colors"
                      style={{ color: active && !isRecord ? "rgba(237,237,237,0.5)" : "rgba(255,255,255,0.18)" }}>
                      {label}
                    </span>
                    {active && !isRecord && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-px"
                        style={{ background: "rgba(255,255,255,0.3)" }} />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      )}

      {/* ══════════════════════════════════════
          DESKTOP ≥ 1024px — left sidebar
          ══════════════════════════════════════ */}
      <aside className="hidden lg:flex" style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: "240px",
        zIndex: 50,
        flexDirection: "column",
        background: "rgba(10,10,10,0.97)",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}>
        {/* Logo */}
        <div className="px-6 pt-8 pb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/" className="flex items-center gap-3">
            <Image src="/media/logo-white.png" alt="Echoes" width={28} height={28}
              style={{ opacity: 0.85, filter: "grayscale(1)" }} />
            <div>
              <span className="text-base font-bold tracking-tight" style={{ color: "#ededed", letterSpacing: "-0.03em", display: "block" }}>
                echoes
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--text-3)" }}>
                records library
              </span>
            </div>
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 px-3 pt-4 flex-1">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            const isRecord = label === "Record";

            if (isRecord) {
              return (
                <Link key={href} href={href}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl font-semibold text-sm mt-1 mb-1 transition-all active:scale-95"
                  style={active
                    ? { background: "#ededed", color: "#0c0c0c" }
                    : { background: "rgba(255,255,255,0.05)", color: "var(--text-2)", border: "1px solid rgba(255,255,255,0.09)" }
                  }>
                  <Icon className="w-4 h-4" strokeWidth={active ? 2.5 : 1.5} />
                  {label}
                </Link>
              );
            }

            return (
              <Link key={href} href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
                style={active
                  ? { background: "rgba(255,255,255,0.07)", color: "#ededed" }
                  : { color: "var(--text-3)" }
                }>
                <Icon className="w-4 h-4" strokeWidth={active ? 2 : 1.5} />
                {label}
                {active && (
                  <span className="ml-auto w-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: $ECHO balance */}
        <div className="px-4 pb-6 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex flex-col gap-2">
            {echoBtn}
            <p className="text-[10px] px-1" style={{ color: "var(--text-3)" }}>
              {provider === "helius" ? "Solana · Helius wallet" : "Solana · Seed Vault / external wallet"}
            </p>
          </div>
        </div>
      </aside>

      {/* Swap modal */}
      {swapOpen && <EchoSwap onClose={() => setSwapOpen(false)} />}
    </>
  );
}
