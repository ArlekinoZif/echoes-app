import type { Metadata } from "next";
import Link from "next/link";
import { Mic } from "lucide-react";

export const metadata: Metadata = {
  title: "Recording not found — Echoes",
  robots: { index: false, follow: false },
};

export default function RecordingNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <Mic className="w-8 h-8 mx-auto mb-4" style={{ color: "var(--text-3)" }} />
        <p className="text-lg font-semibold mb-2" style={{ color: "var(--text-1)" }}>
          This recording is not available
        </p>
        <p className="text-sm mb-5" style={{ color: "var(--text-3)" }}>
          It may have been removed, or it has not been published yet.
        </p>
        <Link href="/" className="text-amber-400 hover:underline">
          Browse the records library
        </Link>
      </div>
    </div>
  );
}
