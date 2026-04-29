"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Mic, User } from "lucide-react";

const NAV = [
  { href: "/", icon: BookOpen, label: "Library" },
  { href: "/record", icon: Mic, label: "Record" },
  { href: "/zone", icon: User, label: "Zone" },
] as const;

/** Hide the nav bar on deep flow pages */
const HIDDEN_ON = ["/record", "/evaluate/", "/tokenize/", "/vote"];

export default function NavBar() {
  const pathname = usePathname();

  // Hide on record page and any detail subpage
  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(p))) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-neutral-950/95 backdrop-blur border-t border-neutral-800 safe-bottom">
      <div className="max-w-xl mx-auto flex">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
                active ? "text-amber-400" : "text-neutral-600 hover:text-neutral-400"
              }`}
            >
              <Icon className={`w-5 h-5 ${label === "Record" ? "w-6 h-6" : ""}`} />
              <span className="text-[10px] font-medium">{label}</span>
              {active && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-amber-500 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
