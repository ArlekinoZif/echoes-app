"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { isSeekerShell, shareLink } from "@/lib/native-bridge";

/**
 * Shares a story link. Inside the Seeker shell this opens the Android share
 * sheet, in a browser it uses Web Share, and otherwise it copies the link.
 */
export default function ShareStoryButton({
  url,
  title,
  category,
  authorTwitter,
}: {
  url: string;
  title: string;
  category?: string;
  authorTwitter?: string;
}) {
  const [copied, setCopied] = useState(false);

  const credit = authorTwitter ? ` by @${authorTwitter}` : "";
  const text = `"${title}"${credit}${category ? ` · ${category}` : ""} — a voice story on Echoes.`;

  async function handleShare() {
    const shared = await shareLink({ title, text, url });
    if (!shared || isSeekerShell()) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
      style={{
        background: "rgba(255,255,255,0.06)",
        color: copied ? "var(--amber)" : "var(--text-2)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {copied ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
