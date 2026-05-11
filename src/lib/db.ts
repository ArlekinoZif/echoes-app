"use client";

import { supabase } from "./supabase";
import { Story, Evaluation } from "./types";

// ── Row → domain mappers ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToStory(row: any): Story {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    audioBlobUrl: row.audio_url,
    durationSeconds: row.duration_secs,
    publishGate: row.publish_gate,
    createdAt: new Date(row.created_at).getTime(),
    status: row.status,
    authorWallet: row.author_wallet ?? undefined,
    coverImageUrl: row.cover_image_url ?? undefined,
    authorTwitter: row.author_twitter ?? undefined,
    listingTxSig: row.listing_tx_sig ?? undefined,
    ticker: row.ticker ?? undefined,
    tokenMint: row.token_mint ?? undefined,
    tokenListingUrl: row.token_listing_url ?? undefined,
    launchType: row.launch_type ?? undefined,
    sponsorWallet: row.sponsor_wallet ?? undefined,
    arweaveCid: row.arweave_cid ?? undefined,
  };
}

function storyToRow(s: Story) {
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    category: s.category,
    audio_url: s.audioBlobUrl,
    duration_secs: s.durationSeconds,
    publish_gate: s.publishGate,
    status: s.status,
    author_wallet: s.authorWallet ?? null,
    listing_tx_sig: s.listingTxSig ?? null,
    ticker: s.ticker ?? null,
    token_mint: s.tokenMint ?? null,
    token_listing_url: s.tokenListingUrl ?? null,
    launch_type: s.launchType ?? null,
    sponsor_wallet: s.sponsorWallet ?? null,
    arweave_cid: s.arweaveCid ?? null,
    // Only include these if the columns exist (migration required)
    ...(s.coverImageUrl !== undefined && { cover_image_url: s.coverImageUrl }),
    ...(s.authorTwitter !== undefined && { author_twitter: s.authorTwitter }),
  };
}

// ── Stories ────────────────────────────────────────────────────────────────

export async function upsertStory(story: Story): Promise<void> {
  const { error } = await supabase
    .from("stories")
    .upsert(storyToRow(story), { onConflict: "id" });
  if (error) throw error;
}

export async function fetchStory(id: string): Promise<Story | null> {
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToStory(data) : null;
}

export async function fetchPublicStories(): Promise<Story[]> {
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .in("status", ["listed", "tokenized"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToStory);
}

export async function fetchStoriesForEvaluation(): Promise<Story[]> {
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .in("status", ["pending_eval", "listed", "tokenized"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToStory);
}

export async function fetchStoriesForSponsor(
  myWallet?: string | null
): Promise<Story[]> {
  let query = supabase
    .from("stories")
    .select("*")
    .eq("status", "listed")
    .is("token_mint", null);
  if (myWallet) {
    query = query.neq("author_wallet", myWallet);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToStory);
}

/** All stories authored by this wallet (any status) */
export async function fetchMyStories(wallet: string): Promise<Story[]> {
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("author_wallet", wallet)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToStory);
}

// ── Evaluations ────────────────────────────────────────────────────────────

export async function upsertEvaluation(
  evaluation: Evaluation,
  evaluatorWallet: string
): Promise<void> {
  const { error } = await supabase.from("evaluations").upsert(
    {
      story_id: evaluation.storyId,
      evaluator_wallet: evaluatorWallet,
      audio_quality: evaluation.criteria.audioQuality,
      storytelling: evaluation.criteria.storytelling,
      description_accuracy: evaluation.criteria.descriptionAccuracy,
      listened_percent: evaluation.listenedPercent,
    },
    { onConflict: "story_id,evaluator_wallet" }
  );
  if (error) throw error;
}

/** Returns story IDs this wallet has evaluated */
export async function fetchMyEvaluatedIds(wallet: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("evaluations")
    .select("story_id")
    .eq("evaluator_wallet", wallet);
  if (error) throw error;
  return (data ?? []).map((r) => r.story_id);
}

// ── Favourites ─────────────────────────────────────────────────────────────

export async function fetchFavourites(wallet: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("favourites")
    .select("story_id")
    .eq("wallet", wallet);
  if (error) throw error;
  return (data ?? []).map((r) => r.story_id);
}

export async function toggleFavouriteDb(
  storyId: string,
  wallet: string
): Promise<boolean> {
  const { data } = await supabase
    .from("favourites")
    .select("story_id")
    .eq("wallet", wallet)
    .eq("story_id", storyId)
    .maybeSingle();

  if (data) {
    await supabase
      .from("favourites")
      .delete()
      .eq("wallet", wallet)
      .eq("story_id", storyId);
    return false;
  } else {
    await supabase.from("favourites").insert({ wallet, story_id: storyId });
    return true;
  }
}
