import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import {
  dbFetchPublicStories,
  dbFetchStoriesForEvaluation,
  dbFetchStoriesForSponsor,
  dbFetchMyStories,
  dbFetchTopStories,
  dbUpsertStory,
  dbFetchStory,
  dbIsListingTransactionUsed,
} from "@/lib/db-server";
import { AuthenticationError, assertOwnIdentity, authErrorResponse, requireUser } from "@/lib/auth-server";
import type { Story } from "@/lib/types";
import { runtimeEnv } from "@/lib/runtime-env";

/** URLs that /api/upload hands out: the private audio proxy or our Supabase Storage. */
function isOwnMediaUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  if (url.startsWith("/api/audio/stories/")) return true;
  const supabase = (runtimeEnv("SUPABASE_URL") ?? runtimeEnv("NEXT_PUBLIC_SUPABASE_URL") ?? "").replace(/\/$/, "");
  if (!supabase) return false;
  return url.startsWith(`${supabase}/storage/v1/object/public/echoes-audio/`) ||
    url.startsWith(`${supabase}/storage/v1/object/public/echoes-images/`);
}
import { verifySolanaListingPayment } from "@/lib/solana-payment-server";

const VALID_CATEGORIES = new Set(["War", "Love", "Immigration", "Entrepreneurship", "Family", "Survival", "Other"]);
const VALID_STATUSES = new Set(["draft", "pending_eval", "listed", "tokenized"]);

function withoutPaymentProof(story: Story): Story {
  const safeStory = { ...story };
  if (safeStory.isPrivate) safeStory.audioBlobUrl = "";
  return safeStory;
}

function safeStories(stories: Story[]) {
  return stories.map(withoutPaymentProof);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "public";
  const wallet = searchParams.get("wallet");

  try {
    switch (type) {
      case "public":
        return NextResponse.json(safeStories(await dbFetchPublicStories()));
      case "top":
        return NextResponse.json(safeStories(await dbFetchTopStories(5)));
      case "evaluate":
        return NextResponse.json(safeStories(await dbFetchStoriesForEvaluation()));
      case "sponsor":
        return NextResponse.json(safeStories(await dbFetchStoriesForSponsor(wallet)));
      case "mine":
        return NextResponse.json(safeStories(await dbFetchMyStories(await requireUser(req))));
      default:
        return NextResponse.json({ error: "unknown type" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof AuthenticationError) return authErrorResponse(err);
    const msg = String(err);
    console.error("[stories GET]", msg);
    // Return empty list when DB is unreachable (no tables yet / DNS timeout) so UI renders gracefully
    if (type === "public" || type === "top" || type === "evaluate" || type === "sponsor") {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser(req);
    const story = await req.json() as Story;
    assertOwnIdentity(userId, story.ownerId);
    if (!story.id || !story.title?.trim() || !story.description?.trim() || !story.audioBlobUrl) {
      return NextResponse.json({ error: "Invalid story" }, { status: 400 });
    }
    if (story.title.length > 80 || story.description.length > 500 || story.durationSeconds <= 0 || story.durationSeconds > 600) {
      return NextResponse.json({ error: "Story fields are outside allowed limits" }, { status: 400 });
    }
    if (!VALID_CATEGORIES.has(story.category) || !VALID_STATUSES.has(story.status) || !["pay", "evaluate"].includes(story.publishGate)) {
      return NextResponse.json({ error: "Invalid story category, status, or publish mode" }, { status: 400 });
    }
    const existing = await dbFetchStory(story.id);
    if (existing?.ownerId && existing.ownerId !== userId) {
      return NextResponse.json({ error: "Cannot modify another user's story" }, { status: 403 });
    }
    // Media must come from our own storage (what /api/upload returns), so a story
    // cannot point listeners at an arbitrary site. Unchanged legacy URLs pass.
    if (story.audioBlobUrl !== existing?.audioBlobUrl && !isOwnMediaUrl(story.audioBlobUrl)) {
      return NextResponse.json({ error: "Audio must be uploaded through Echoes" }, { status: 400 });
    }
    if (story.coverImageUrl && story.coverImageUrl !== existing?.coverImageUrl && !isOwnMediaUrl(story.coverImageUrl)) {
      return NextResponse.json({ error: "Cover must be uploaded through Echoes" }, { status: 400 });
    }
    if (!existing && story.status === "tokenized") {
      return NextResponse.json({ error: "A new story cannot start as tokenized" }, { status: 400 });
    }
    if (existing?.status === "tokenized" && story.status !== "tokenized") {
      return NextResponse.json({ error: "A tokenized story cannot be reverted" }, { status: 409 });
    }
    const becomesDirectlyListed = story.status === "listed" && existing?.status !== "listed" && existing?.status !== "tokenized";
    if (becomesDirectlyListed) {
      if (story.listingTxSig) {
        if (!story.authorWallet) {
          return NextResponse.json({ error: "A payment wallet is required" }, { status: 400 });
        }
        if (await dbIsListingTransactionUsed(story.listingTxSig, story.id)) {
          return NextResponse.json({ error: "This Solana payment has already been used" }, { status: 409 });
        }
        await verifySolanaListingPayment(story.listingTxSig, story.authorWallet);
      } else {
        return NextResponse.json({ error: "A verified Solana payment is required to publish" }, { status: 402 });
      }
    }
    await dbUpsertStory(story);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthenticationError) return authErrorResponse(err);
    console.error("[stories POST]", err);
    return internalError(err, "stories");
  }
}
