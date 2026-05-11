"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Mic, User } from "lucide-react";

const NAV = [
  { href: "/", icon: BookOpen, label: "Library" },
  { href: "/record", icon: Mic, label: "Record" },
  { href: "/zone", icon: User, label: "Patio" },
] as const;

const HIDDEN_ON = ["/record", "/evaluate/", "/list/", "/vote"];

export default function NavBar() {
  const pathname = usePathname();

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(p))) {
    return null;
  }

  return (
    <nav
      className="safe-bottom"
      style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, background: "transparent" }}
    >
      {/* pill container */}
      <div className="max-w-xs mx-auto mb-5 px-2">
        <div
          className="flex items-center rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.9)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.8) inset",
          }}
        >
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            const isRecord = label === "Record";

            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all relative"
              >
                {isRecord ? (
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform active:scale-90"
                    style={{
                      background: "linear-gradient(135deg, #a8edea, #fed6e3, #c3b1e1)",
                    }}
                  >
                    <Icon className="w-4 h-4 text-black" strokeWidth={2.5} />
                  </div>
                ) : (
                  <Icon
                    className="w-5 h-5 transition-colors"
                    style={{ color: active ? "#111111" : "rgba(0,0,0,0.28)" }}
                    strokeWidth={active ? 2 : 1.5}
                  />
                )}
                <span
                  className="text-[9px] font-semibold uppercase tracking-widest transition-colors"
                  style={{
                    color: active && !isRecord
                      ? "rgba(0,0,0,0.6)"
                      : isRecord
                      ? "rgba(0,0,0,0.35)"
                      : "rgba(0,0,0,0.25)",
                  }}
                >
                  {label}
                </span>
                {active && !isRecord && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-px"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(168,237,234,0.8), transparent)",
                    }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
