/**
 * Public page for a single recording — the link that gets shared.
 *
 * The path is `/recordings/<slug>-<id>`; only the trailing id is authoritative,
 * so a renamed story keeps working through old links. Private recordings show
 * their cover and price but never their audio: playback goes through the unlock
 * flow, which verifies payment on-chain.
 */
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Mic, Lock, ExternalLink } from "lucide-react";
import AudioPlayer from "@/components/AudioPlayer";
import ShareStoryButton from "@/components/ShareStoryButton";
import { dbFetchStory } from "@/lib/db-server";
import { Story } from "@/lib/types";
import { isPubliclyVisible, siteUrl, storyIdFromSlug, storyUrl } from "@/lib/story-url";

// Rendered per request: the story is looked up in the database, and a missing
// one must answer 404 rather than being cached as a page.
export const revalidate = 0;

function formatDuration(seconds: number): string | null {
  if (!seconds) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins ? `${mins}m ${secs}s` : `${secs}s`;
}

function authorLabel(story: Story): string | null {
  if (story.authorTwitter) return `@${story.authorTwitter}`;
  if (story.authorWallet) return `${story.authorWallet.slice(0, 4)}…${story.authorWallet.slice(-4)}`;
  return null;
}

async function loadStory(slug: string): Promise<Story | null> {
  const id = storyIdFromSlug(slug);
  if (!id) return null;
  const story = await dbFetchStory(id).catch(() => null);
  return story && isPubliclyVisible(story) ? story : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const story = await loadStory(slug);
  // Deciding the 404 here, before rendering starts, is what makes the response
  // status actually 404 — returning metadata first commits a 200.
  if (!story) notFound();

  const facts = [story.category, authorLabel(story), formatDuration(story.durationSeconds)]
    .filter(Boolean)
    .join(" · ");
  const description = story.description?.trim() || `${facts} — a voice story on Echoes.`;
  const image = story.coverImageUrl || `${siteUrl()}/media/echoes-logo.png`;
  const url = storyUrl(story);

  return {
    title: `${story.title} — Echoes`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: story.title,
      description,
      siteName: "Echoes",
      images: [{ url: image }],
    },
    twitter: { card: "summary_large_image", title: story.title, description, images: [image] },
  };
}

export default async function RecordingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const story = await loadStory(slug);
  if (!story) notFound();

  const facts = [story.category, authorLabel(story), formatDuration(story.durationSeconds)]
    .filter(Boolean)
    .join(" · ");
  const locked = Boolean(story.isPrivate);

  return (
    <div className="min-h-screen">
      <div className="max-w-xl mx-auto px-4 pt-8 pb-24">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 mb-6 text-sm transition-opacity hover:opacity-80"
          style={{ color: "var(--text-3)" }}
        >
          <ArrowLeft className="w-4 h-4" /> Records library
        </Link>

        <article className="glass overflow-hidden" style={{ borderRadius: "18px" }}>
          <div className="relative w-full aspect-video" style={{ background: "rgba(255,255,255,0.03)" }}>
            {story.coverImageUrl ? (
              <Image
                src={story.coverImageUrl}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 576px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Mic className="w-8 h-8" style={{ color: "var(--text-3)" }} />
              </div>
            )}
            {locked && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                style={{ background: "rgba(0,0,0,0.6)" }}
              >
                <Lock className="w-6 h-6" style={{ color: "var(--amber)" }} />
                <p className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>
                  {story.priceSol ? `${story.priceSol} SOL to unlock` : "Private recording"}
                </p>
              </div>
            )}
          </div>

          <div className="p-5 flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-bold leading-tight" style={{ color: "var(--text-1)" }}>
                {story.title}
              </h1>
              {facts && (
                <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
                  {facts}
                </p>
              )}
            </div>

            {story.description && (
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                {story.description}
              </p>
            )}

            {locked ? (
              <Link
                href={`/unlock/${story.id}`}
                className="btn-gold flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold"
              >
                <Lock className="w-4 h-4" />
                {story.priceSol ? `Unlock for ${story.priceSol} SOL` : "Unlock this recording"}
              </Link>
            ) : story.audioBlobUrl ? (
              <AudioPlayer
                src={story.audioBlobUrl}
                durationSeconds={story.durationSeconds}
                title={story.title}
                artist={authorLabel(story) ?? story.category}
                artwork={story.coverImageUrl}
              />
            ) : (
              <p className="text-sm" style={{ color: "var(--text-3)" }}>
                Audio unavailable for this recording.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <ShareStoryButton
                url={storyUrl(story)}
                title={story.title}
                category={story.category}
                authorTwitter={story.authorTwitter}
              />
              {story.tokenListingUrl && (
                <a
                  href={story.tokenListingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gold flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                >
                  <ExternalLink className="w-3 h-3" /> Trade
                </a>
              )}
            </div>
          </div>
        </article>

        <div className="glass mt-4 p-4 rounded-2xl flex items-center justify-between gap-3">
          <p className="text-xs" style={{ color: "var(--text-2)" }}>
            Record your own story on Echoes — free to publish.
          </p>
          <Link
            href="/record"
            className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "var(--text-1)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            Start recording
          </Link>
        </div>
      </div>
    </div>
  );
}
