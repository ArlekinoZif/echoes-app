"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { checkUnlock, recordUnlock } from "@/lib/db";
import { Story } from "@/lib/types";
import AudioPlayer from "@/components/AudioPlayer";
import { Lock, Unlock, Loader2, Mic, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

export default function UnlockPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const router = useRouter();
  const { address, connect, signAndSendAllBase64Txs } = useWallet();

  const [story, setStory] = useState<Story | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await authenticatedFetch(`/api/stories/${storyId}`);
        if (!res.ok) throw new Error("Story not found");
        const s: Story = await res.json();
        setStory(s);

        if (address && s.isPrivate) {
          const already = await checkUnlock(storyId, address);
          setUnlocked(already);
        } else if (!s.isPrivate) {
          setUnlocked(true);
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [storyId, address]);  

  async function handlePay() {
    if (!address) {
      try { await connect(); } catch { return; }
    }
    if (!story?.priceSol) return;
    setPaying(true);
    setError(null);

    try {
      // Build a simple SOL transfer to the author
      const res = await authenticatedFetch(`/api/unlock/tx?storyId=${storyId}&buyer=${address}`);
      if (!res.ok) throw new Error("Failed to build payment transaction");
      const { transactions } = await res.json() as { transactions: string[] };
      const sigs = await signAndSendAllBase64Txs(transactions);
      await recordUnlock(storyId, address!, sigs[0]);
      const storyResponse = await authenticatedFetch(`/api/stories/${storyId}`);
      if (!storyResponse.ok) throw new Error("Payment succeeded, but the audio could not be loaded");
      setStory(await storyResponse.json() as Story);
      setUnlocked(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-3)" }} />
      </div>
    );
  }

  if (!story || error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm font-medium" style={{ color: "var(--text-2)" }}>{error ?? "Story not found"}</p>
        <Link href="/" className="text-sm underline" style={{ color: "var(--text-3)" }}>← Back to library</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-xl mx-auto px-4 pt-10 pb-24">
        {/* Back */}
        <button onClick={() => router.back()} className="flex items-center gap-1.5 mb-6 text-sm" style={{ color: "var(--text-3)" }}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Cover */}
        <div
          className="relative w-full rounded-2xl overflow-hidden mb-5"
          style={{ height: "200px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {story.coverImageUrl ? (
            <Image src={story.coverImageUrl} alt="cover" fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Mic className="w-12 h-12 opacity-20" />
            </div>
          )}
          {/* Lock overlay when not unlocked */}
          {!unlocked && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
              style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
            >
              <Lock className="w-10 h-10 text-white opacity-70" />
              <span className="text-white text-sm font-semibold opacity-80">Private Story</span>
            </div>
          )}
        </div>

        {/* Info */}
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-1)" }}>{story.title}</h1>
        <p className="text-sm mb-1" style={{ color: "var(--text-3)" }}>
          {story.category}
          {story.authorTwitter && ` · @${story.authorTwitter}`}
        </p>
        {story.description && (
          <p className="text-sm mt-3 mb-5" style={{ color: "var(--text-2)" }}>{story.description}</p>
        )}

        {/* Unlocked: show player */}
        {unlocked && story.audioBlobUrl && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Unlock className="w-4 h-4" style={{ color: "#10b981" }} />
              <span className="text-sm font-semibold" style={{ color: "#10b981" }}>Unlocked — enjoy!</span>
            </div>
            <AudioPlayer src={story.audioBlobUrl} durationSeconds={story.durationSeconds}
              title={story.title} artist={story.authorTwitter ?? story.category} artwork={story.coverImageUrl} />
          </div>
        )}

        {/* Locked: paywall */}
        {!unlocked && (
          <div className="glass p-5 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(200,168,75,0.12)" }}
              >
                <Lock className="w-5 h-5" style={{ color: "var(--amber)" }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-1)" }}>Private Audio</p>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>
                  One-time unlock — yours forever after
                </p>
              </div>
            </div>

            <div
              className="flex items-center justify-between px-3 py-3 rounded-xl"
              style={{ background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.2)" }}
            >
              <span className="text-sm" style={{ color: "var(--text-2)" }}>Unlock price</span>
              <span className="text-lg font-bold" style={{ color: "var(--amber)" }}>
                {story.priceSol} SOL
              </span>
            </div>

            {error && (
              <p className="text-xs text-center" style={{ color: "#f43f5e" }}>{error}</p>
            )}

            {!address ? (
              <button
                onClick={() => connect()}
                className="btn-gold w-full py-3 rounded-2xl font-semibold text-sm transition-opacity hover:opacity-90"
              >
                Connect wallet to unlock
              </button>
            ) : (
              <button
                onClick={handlePay}
                disabled={paying}
                className="btn-gold w-full py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {paying ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                ) : (
                  <><Unlock className="w-4 h-4" /> Pay {story.priceSol} SOL & Unlock</>
                )}
              </button>
            )}

            <p className="text-xs text-center" style={{ color: "var(--text-3)" }}>
              Payment goes to the author. 25% platform fee applies.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
