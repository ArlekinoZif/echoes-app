// Server-side DB layer
// Supabase is mandatory in production. The local JSON backend is development-only.

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Story, Evaluation } from "./types";
import * as local from "./local-db";
import { runtimeEnv } from "@/lib/runtime-env";

// ── Supabase client ───────────────────────────────────────────────────────────

export interface UserProfile {
  wallet: string;
  age?: number;
  gender?: string;
  status?: string;
  country?: string;
  languages?: string;
  goals?: string;
  email?: string;
  twitter?: string;
  referralCode?: string;
  referredBy?: string;
  referralSplit?: number;
}

function getSupabase(): SupabaseClient | null {
  // Read at runtime: a build-inlined URL would pin the deploy to whichever
  // Supabase project the build machine happened to be configured for.
  const url = runtimeEnv("SUPABASE_URL") ?? runtimeEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;

  return createClient(url, key, {
    global: {
      fetch: (input, init) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
      },
    },
  });
}

function runLocalFallback<T>(operation: () => T): T {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Production database is unavailable");
  }
  return operation();
}

// ── Row mappers ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToStory(row: any): Story {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    category: row.category,
    audioBlobUrl: row.audio_url,
    durationSeconds: Number(row.duration_secs ?? row.durationSeconds ?? 0),
    publishGate: row.publish_gate ?? "evaluate",
    createdAt: new Date(row.created_at).getTime(),
    status: row.status,
    ownerId: row.owner_id ?? undefined,
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
    isPrivate: row.is_private === 1 || row.is_private === true,
    priceSol: row.price_sol ?? undefined,
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
    owner_id: s.ownerId ?? null,
    author_wallet: s.authorWallet ?? null,
    cover_image_url: s.coverImageUrl ?? null,
    author_twitter: s.authorTwitter ?? null,
    listing_tx_sig: s.listingTxSig ?? null,
    ticker: s.ticker ?? null,
    token_mint: s.tokenMint ?? null,
    token_listing_url: s.tokenListingUrl ?? null,
    launch_type: s.launchType ?? null,
    sponsor_wallet: s.sponsorWallet ?? null,
    arweave_cid: s.arweaveCid ?? null,
    is_private: s.isPrivate ?? false,
    price_sol: s.priceSol ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProfile(row: any): UserProfile {
  return {
    wallet: row.wallet,
    age: row.age ?? undefined,
    gender: row.gender ?? undefined,
    status: row.status ?? undefined,
    country: row.country ?? undefined,
    languages: row.languages ?? undefined,
    goals: row.goals ?? undefined,
    email: row.email ?? undefined,
    twitter: row.twitter ?? undefined,
    referralCode: row.referral_code ?? undefined,
    referredBy: row.referred_by ?? undefined,
    referralSplit: row.referral_split ?? 0.5,
  };
}

// ── Stories ───────────────────────────────────────────────────────────────────

export async function dbUpsertStory(story: Story): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("stories").upsert(storyToRow(story), { onConflict: "id" });
      if (!error) {
        return;
      }
      console.warn("[db] Supabase upsertStory error, using local:", error.message);
    } catch (e) {
      console.warn("[db] Supabase upsertStory unreachable, using local:", e);
    }
  }
  return runLocalFallback(() => local.localUpsertStory(story));
}

export async function dbFetchStory(id: string): Promise<Story | null> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from("stories").select("*").eq("id", id).maybeSingle();
      if (!error) return data ? rowToStory(data) : null;
      console.warn("[db] Supabase fetchStory error:", error.message);
    } catch (e) {
      console.warn("[db] Supabase fetchStory unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localFetchStory(id));
}

export async function dbFetchStoryByAudioUrl(audioUrl: string): Promise<Story | null> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from("stories").select("*").eq("audio_url", audioUrl).maybeSingle();
      if (!error) return data ? rowToStory(data) : null;
      console.warn("[db] fetch story by audio URL error:", error.message);
    } catch (e) {
      console.warn("[db] fetch story by audio URL unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localFetchStoryByAudioUrl(audioUrl));
}

export async function dbFetchPublicStories(): Promise<Story[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("stories")
        .select("*")
        .in("status", ["listed", "tokenized"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (!error) return (data ?? []).map(rowToStory);
      console.warn("[db] Supabase fetchPublicStories error:", error.message);
    } catch (e) {
      console.warn("[db] Supabase fetchPublicStories unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localFetchPublicStories());
}

export async function dbFetchTopStories(limit = 5): Promise<Story[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("stories")
        .select("*")
        .in("status", ["listed", "tokenized"])
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!error) return (data ?? []).map(rowToStory);
      console.warn("[db] Supabase fetchTopStories error:", error.message);
    } catch (e) {
      console.warn("[db] Supabase fetchTopStories unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localFetchTopStories(limit));
}

export async function dbFetchStoriesForEvaluation(): Promise<Story[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("stories")
        .select("*")
        .in("status", ["pending_eval", "listed", "tokenized"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (!error) return (data ?? []).map(rowToStory);
      console.warn("[db] Supabase fetchStoriesForEvaluation error:", error.message);
    } catch (e) {
      console.warn("[db] Supabase fetchStoriesForEvaluation unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localFetchStoriesForEvaluation());
}

export async function dbFetchStoriesForSponsor(myId?: string | null): Promise<Story[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      let q = sb.from("stories").select("*").eq("status", "listed").is("token_mint", null);
      if (myId) q = q.neq("owner_id", myId);
      const { data, error } = await q;
      if (!error) return (data ?? []).map(rowToStory);
      console.warn("[db] Supabase fetchStoriesForSponsor error:", error.message);
    } catch (e) {
      console.warn("[db] Supabase fetchStoriesForSponsor unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localFetchStoriesForSponsor(myId));
}

export async function dbFetchMyStories(ownerId: string): Promise<Story[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("stories")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });
      if (!error) return (data ?? []).map(rowToStory);
      console.warn("[db] Supabase fetchMyStories error:", error.message);
    } catch (e) {
      console.warn("[db] Supabase fetchMyStories unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localFetchMyStories(ownerId));
}

export async function dbIsListingTransactionUsed(signature: string, exceptStoryId?: string): Promise<boolean> {
  const sb = getSupabase();
  if (sb) {
    try {
      let query = sb.from("stories").select("id", { count: "exact", head: true }).eq("listing_tx_sig", signature);
      if (exceptStoryId) query = query.neq("id", exceptStoryId);
      const { count, error } = await query;
      if (!error) return (count ?? 0) > 0;
      console.warn("[db] listing transaction lookup error:", error.message);
    } catch (e) {
      console.warn("[db] listing transaction lookup unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localIsListingTransactionUsed(signature, exceptStoryId));
}

// ── Evaluations ───────────────────────────────────────────────────────────────

export async function dbUpsertEvaluation(evaluation: Evaluation, evaluatorWallet: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("evaluations").upsert({
        story_id: evaluation.storyId,
        evaluator_wallet: evaluatorWallet,
        audio_quality: evaluation.criteria.audioQuality,
        storytelling: evaluation.criteria.storytelling,
        description_accuracy: evaluation.criteria.descriptionAccuracy,
        listened_percent: evaluation.listenedPercent,
      }, { onConflict: "story_id,evaluator_wallet" });

      if (!error) {
        // Auto-promote after 3 reviews
        const { count } = await sb
          .from("evaluations")
          .select("*", { count: "exact", head: true })
          .eq("story_id", evaluation.storyId);
        if ((count ?? 0) >= 3) {
          await sb.from("stories").update({ status: "listed" }).eq("id", evaluation.storyId).eq("status", "pending_eval");
        }
        return;
      }
      console.warn("[db] Supabase upsertEvaluation error:", error.message);
    } catch (e) {
      console.warn("[db] Supabase upsertEvaluation unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localUpsertEvaluation(evaluation, evaluatorWallet));
}

export async function dbFetchMyEvaluatedIds(wallet: string): Promise<string[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from("evaluations").select("story_id").eq("evaluator_wallet", wallet);
      if (!error) return (data ?? []).map((r: { story_id: string }) => r.story_id);
      console.warn("[db] Supabase fetchMyEvaluatedIds error:", error.message);
    } catch (e) {
      console.warn("[db] Supabase fetchMyEvaluatedIds unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localFetchMyEvaluatedIds(wallet));
}

// ── Favourites ────────────────────────────────────────────────────────────────

export async function dbFetchFavourites(wallet: string): Promise<string[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from("favourites").select("story_id").eq("wallet", wallet);
      if (!error) return (data ?? []).map((r: { story_id: string }) => r.story_id);
      console.warn("[db] Supabase fetchFavourites error:", error.message);
    } catch (e) {
      console.warn("[db] Supabase fetchFavourites unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localFetchFavourites(wallet));
}

export async function dbToggleFavourite(storyId: string, wallet: string): Promise<boolean> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data: existing } = await sb
        .from("favourites")
        .select("story_id")
        .eq("wallet", wallet)
        .eq("story_id", storyId)
        .maybeSingle();
      if (existing !== undefined) {
        if (existing) {
          await sb.from("favourites").delete().eq("wallet", wallet).eq("story_id", storyId);
          return false;
        }
        await sb.from("favourites").insert({ wallet, story_id: storyId });
        return true;
      }
    } catch (e) {
      console.warn("[db] Supabase toggleFavourite unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localToggleFavourite(storyId, wallet));
}

// ── User Profiles ─────────────────────────────────────────────────────────────

export async function dbUpsertProfile(profile: UserProfile): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    try {
      const code = profile.referralCode ?? Math.random().toString(36).slice(2, 8).toUpperCase();
      const { error } = await sb.from("user_profiles").upsert({
        wallet: profile.wallet,
        age: profile.age ?? null,
        gender: profile.gender ?? null,
        status: profile.status ?? null,
        country: profile.country ?? null,
        languages: profile.languages ?? null,
        goals: profile.goals ?? null,
        email: profile.email ?? null,
        twitter: profile.twitter ?? null,
        referral_code: code,
        referred_by: profile.referredBy ?? null,
        referral_split: profile.referralSplit ?? 0.5,
      }, { onConflict: "wallet" });

      if (!error) {
        return;
      }
      console.warn("[db] Supabase upsertProfile error:", error.message);
    } catch (e) {
      console.warn("[db] Supabase upsertProfile unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localUpsertProfile(profile));
}

export async function dbFetchProfile(wallet: string): Promise<UserProfile | null> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from("user_profiles").select("*").eq("wallet", wallet).maybeSingle();
      if (!error) return data ? rowToProfile(data) : null;
      console.warn("[db] Supabase fetchProfile error:", error.message);
    } catch (e) {
      console.warn("[db] Supabase fetchProfile unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localFetchProfile(wallet));
}

// ── Private unlocks ───────────────────────────────────────────────────────────

export async function dbCheckUnlock(storyId: string, buyerId: string): Promise<boolean> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("private_unlocks")
        .select("id")
        .eq("story_id", storyId)
        .eq("buyer_id", buyerId)
        .maybeSingle();
      if (!error) return !!data;
      console.warn("[db] Supabase checkUnlock error:", error.message);
    } catch (e) {
      console.warn("[db] Supabase checkUnlock unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localCheckUnlock(storyId, buyerId));
}

export async function dbIsUnlockTransactionUsed(txSig: string): Promise<boolean> {
  const sb = getSupabase();
  if (sb) {
    const { count, error } = await sb.from("private_unlocks").select("id", { count: "exact", head: true }).eq("tx_sig", txSig);
    if (error) throw new Error(`Unlock transaction lookup failed: ${error.message}`);
    return (count ?? 0) > 0;
  }
  return runLocalFallback(() => local.localIsUnlockTransactionUsed(txSig));
}

export async function dbRecordUnlock(storyId: string, buyerId: string, wallet: string, txSig: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb
        .from("private_unlocks")
        .upsert({ story_id: storyId, buyer_id: buyerId, wallet, tx_sig: txSig }, { onConflict: "story_id,buyer_id" });
      if (!error) {
        return;
      }
      throw new Error(`Record unlock failed: ${error.message}`);
    } catch (e) {
      throw e;
    }
  }
  return runLocalFallback(() => local.localRecordUnlock(storyId, buyerId, wallet, txSig));
}

// ── Health check ──────────────────────────────────────────────────────────────
// Returns which backend is currently active. Used by /api/dashboard.

export async function dbHealth(): Promise<{ backend: "supabase" | "local" | "unavailable"; ok: boolean }> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("stories").select("id").limit(1);
      if (!error) return { backend: "supabase", ok: true };
    } catch {
      // fall through
    }
  }
  return process.env.NODE_ENV === "production"
    ? { backend: "unavailable", ok: false }
    : { backend: "local", ok: true };
}

// ── Profiles (batch) and referrals ────────────────────────────────────────────

/** Public subset lookup for several wallets at once, used by /api/profiles. */
export async function dbFetchProfiles(wallets: string[]): Promise<UserProfile[]> {
  if (!wallets.length) return [];
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from("user_profiles").select("*").in("wallet", wallets);
      if (!error) return (data ?? []).map(rowToProfile);
      console.warn("[db] Supabase fetchProfiles error:", error.message);
    } catch (e) {
      console.warn("[db] Supabase fetchProfiles unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localFetchProfiles(wallets));
}

/** How many profiles were referred by this referral code. */
export async function dbCountReferrals(code: string): Promise<number> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { count, error } = await sb
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("referred_by", code);
      if (!error) return count ?? 0;
      console.warn("[db] Supabase countReferrals error:", error.message);
    } catch (e) {
      console.warn("[db] Supabase countReferrals unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localCountReferrals(code));
}

// ── Weekly pool ballots ───────────────────────────────────────────────────────

export interface PoolBallot {
  poolId: number;
  voter: string;
  commitment: string;
  echoesAmount: number;
  revealed: boolean;
  storyId: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBallot(row: any): PoolBallot {
  return {
    poolId: Number(row.pool_id),
    voter: row.voter,
    commitment: row.commitment,
    echoesAmount: Number(row.echoes_amount ?? 0),
    revealed: row.revealed === true || row.revealed === 1,
    storyId: row.story_id ?? null,
  };
}

export async function dbFetchBallots(poolId: number): Promise<PoolBallot[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from("pool_ballots").select("*").eq("pool_id", poolId);
      if (!error) return (data ?? []).map(rowToBallot);
      console.warn("[db] Supabase fetchBallots error:", error.message);
    } catch (e) {
      console.warn("[db] Supabase fetchBallots unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localFetchBallots(poolId).map(rowToBallot));
}

export async function dbFetchBallot(poolId: number, voter: string): Promise<PoolBallot | null> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("pool_ballots")
        .select("*")
        .eq("pool_id", poolId)
        .eq("voter", voter)
        .maybeSingle();
      if (!error) return data ? rowToBallot(data) : null;
      console.warn("[db] Supabase fetchBallot error:", error.message);
    } catch (e) {
      console.warn("[db] Supabase fetchBallot unreachable:", e);
    }
  }
  const found = runLocalFallback(() => local.localFetchBallot(poolId, voter));
  return found ? rowToBallot(found) : null;
}

/**
 * One ballot per voter per pool. The unique index on (pool_id, voter) is what
 * actually enforces it, so a racing second vote fails here rather than silently
 * overwriting the first.
 */
export async function dbSaveBallot(
  poolId: number,
  voter: string,
  commitment: string,
  echoesAmount: number
): Promise<{ ok: boolean; reason?: "already_voted" }> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("pool_ballots").insert({
        pool_id: poolId,
        voter,
        commitment,
        echoes_amount: echoesAmount,
        revealed: false,
        story_id: null,
      });
      if (!error) return { ok: true };
      if (error.code === "23505") return { ok: false, reason: "already_voted" };
      console.warn("[db] Supabase saveBallot error:", error.message);
    } catch (e) {
      console.warn("[db] Supabase saveBallot unreachable:", e);
    }
  }
  return runLocalFallback(() => local.localSaveBallot(poolId, voter, commitment, echoesAmount));
}

export async function dbRevealBallot(poolId: number, voter: string, storyId: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb
        .from("pool_ballots")
        .update({ revealed: true, story_id: storyId })
        .eq("pool_id", poolId)
        .eq("voter", voter);
      if (!error) return;
      throw new Error(`Reveal ballot failed: ${error.message}`);
    } catch (e) {
      throw e;
    }
  }
  return runLocalFallback(() => local.localRevealBallot(poolId, voter, storyId));
}

// ── Content reports ───────────────────────────────────────────────────────────

export interface ContentReport {
  id: string;
  storyId: string;
  reporterId: string;
  reason: string;
  details?: string;
}

/** Records a report. One report per story per reporter; a repeat is a no-op. */
export async function dbInsertReport(report: ContentReport): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("content_reports").upsert(
        {
          id: report.id,
          story_id: report.storyId,
          reporter_id: report.reporterId,
          reason: report.reason,
          details: report.details ?? null,
          status: "open",
        },
        { onConflict: "story_id,reporter_id" }
      );
      if (!error) return;
      throw new Error(`Report failed: ${error.message}`);
    } catch (e) {
      throw e;
    }
  }
  return runLocalFallback(() =>
    local.localInsertReport({
      id: report.id,
      story_id: report.storyId,
      reporter_id: report.reporterId,
      reason: report.reason,
      details: report.details,
      created_at: Date.now(),
    })
  );
}

// ── Account deletion ──────────────────────────────────────────────────────────

/**
 * Erases everything the product holds about one account: profile, favourites,
 * evaluations and reports, plus every story the account owns. A tokenised story
 * has an on-chain life of its own and cannot be withdrawn, so its personal
 * identifiers are stripped instead of deleting the row.
 */
export async function dbDeleteAccount(userId: string): Promise<{ deletedStories: number; anonymisedStories: number }> {
  const sb = getSupabase();
  if (!sb) {
    runLocalFallback(() => local.localDeleteAccount(userId));
    return { deletedStories: 0, anonymisedStories: 0 };
  }

  const { data: owned, error: ownedError } = await sb
    .from("stories")
    .select("id, token_mint")
    .eq("owner_id", userId);
  if (ownedError) throw new Error(`Account deletion failed: ${ownedError.message}`);

  const rows = owned ?? [];
  const tokenised = rows.filter((r) => r.token_mint).map((r) => r.id);
  const removable = rows.filter((r) => !r.token_mint).map((r) => r.id);

  if (tokenised.length) {
    const { error } = await sb
      .from("stories")
      .update({ owner_id: null, author_twitter: null })
      .in("id", tokenised);
    if (error) throw new Error(`Account deletion failed: ${error.message}`);
  }
  if (removable.length) {
    const { error } = await sb.from("stories").delete().in("id", removable);
    if (error) throw new Error(`Account deletion failed: ${error.message}`);
  }

  for (const [table, column] of [
    ["user_profiles", "wallet"],
    ["favourites", "wallet"],
    ["evaluations", "evaluator_wallet"],
    ["content_reports", "reporter_id"],
    ["private_unlocks", "buyer_id"],
    ["app_sessions", "wallet"],
    ["seeker_verifications", "wallet"],
  ] as const) {
    const { error } = await sb.from(table).delete().eq(column, userId);
    // A table that does not exist yet must not block the rest of the erasure.
    // Postgres reports it as 42P01; PostgREST, before reaching Postgres, as PGRST205.
    if (error && error.code !== "42P01" && error.code !== "PGRST205") {
      throw new Error(`Account deletion failed on ${table}: ${error.message}`);
    }
  }

  return { deletedStories: removable.length, anonymisedStories: tokenised.length };
}

// ── Schema capability checks ──────────────────────────────────────────────────
//
// Some features depend on migrations that production may not have yet. A feature
// whose table or column is missing must refuse up front — above all an unlock,
// which would otherwise take the buyer's payment and then fail to record it.
// A positive answer is cached for the process lifetime; a negative one is
// re-checked after a minute so the feature switches on once the migration runs.

const capabilityCache = new Map<string, { ok: boolean; at: number }>();

async function hasCapability(key: string, probe: (sb: SupabaseClient) => PromiseLike<{ error: { code?: string } | null }>): Promise<boolean> {
  const cached = capabilityCache.get(key);
  if (cached && (cached.ok || Date.now() - cached.at < 60_000)) return cached.ok;

  const sb = getSupabase();
  if (!sb) {
    // The local development store supports everything.
    return process.env.NODE_ENV !== "production";
  }
  const { error } = await probe(sb);
  const ok = !error;
  capabilityCache.set(key, { ok, at: Date.now() });
  if (!ok) console.warn(`[db] capability "${key}" unavailable: ${error?.code ?? "unknown"}`);
  return ok;
}

/** Migration 004: unlocks are bound to the buyer's session identity. */
export function dbSupportsBuyerUnlocks(): Promise<boolean> {
  return hasCapability("private_unlocks.buyer_id", (sb) =>
    sb.from("private_unlocks").select("buyer_id").limit(1)
  );
}

/** Migration 006: content reports. */
export function dbSupportsReports(): Promise<boolean> {
  return hasCapability("content_reports", (sb) =>
    sb.from("content_reports").select("id").limit(1)
  );
}

// ── Signed-in app devices and Seeker verification (migration 007) ───────────

export interface AppSession {
  id: string;
  wallet: string;
  deviceName: string | null;
  platform: string | null;
  isSeeker: boolean;
  createdAt: string;
  lastSeenAt: string;
}

/** In-memory stand-in for local development without Supabase. */
const localSessions = new Map<string, AppSession & { revoked: boolean }>();
const localSeekers = new Map<string, string>();

export function dbSupportsAppSessions(): Promise<boolean> {
  return hasCapability("app_sessions", (sb) => sb.from("app_sessions").select("id").limit(1));
}

export function dbSupportsSeekerVerification(): Promise<boolean> {
  return hasCapability("seeker_verifications", (sb) => sb.from("seeker_verifications").select("wallet").limit(1));
}

function toAppSession(row: Record<string, unknown>): AppSession {
  return {
    id: String(row.id),
    wallet: String(row.wallet),
    deviceName: (row.device_name as string | null) ?? null,
    platform: (row.platform as string | null) ?? null,
    isSeeker: Boolean(row.is_seeker),
    createdAt: String(row.created_at),
    lastSeenAt: String(row.last_seen_at),
  };
}

export async function dbCreateAppSession(session: Omit<AppSession, "createdAt" | "lastSeenAt">): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const now = new Date().toISOString();
    localSessions.set(session.id, { ...session, createdAt: now, lastSeenAt: now, revoked: false });
    return;
  }
  const { error } = await sb.from("app_sessions").insert({
    id: session.id,
    wallet: session.wallet,
    device_name: session.deviceName,
    platform: session.platform,
    is_seeker: session.isSeeker,
  });
  if (error) throw new Error(`Could not record the session: ${error.message}`);
}

export async function dbListAppSessions(wallet: string): Promise<AppSession[]> {
  const sb = getSupabase();
  if (!sb) {
    return [...localSessions.values()].filter((s) => s.wallet === wallet && !s.revoked);
  }
  const { data, error } = await sb
    .from("app_sessions")
    .select("id, wallet, device_name, platform, is_seeker, created_at, last_seen_at")
    .eq("wallet", wallet)
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toAppSession);
}

/** Revokes one of the wallet's own sessions. Returns false when it is not theirs. */
export async function dbRevokeAppSession(wallet: string, id: string): Promise<boolean> {
  revocationCache.delete(id);
  const sb = getSupabase();
  if (!sb) {
    const s = localSessions.get(id);
    if (!s || s.wallet !== wallet) return false;
    s.revoked = true;
    return true;
  }
  const { data, error } = await sb
    .from("app_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("wallet", wallet)
    .is("revoked_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/**
 * Whether a session id is still valid, cached briefly so authentication does not
 * cost a database round trip on every request. A revoked device is signed out
 * within [REVOCATION_TTL_MS]. Also refreshes last-seen at most once a minute.
 */
const revocationCache = new Map<string, { active: boolean; at: number }>();
const REVOCATION_TTL_MS = 30_000;
const lastTouched = new Map<string, number>();

export async function dbAppSessionActive(id: string): Promise<boolean> {
  const cached = revocationCache.get(id);
  if (cached && Date.now() - cached.at < REVOCATION_TTL_MS) return cached.active;

  const sb = getSupabase();
  let active: boolean;
  if (!sb) {
    const s = localSessions.get(id);
    active = !!s && !s.revoked;
  } else {
    const { data, error } = await sb.from("app_sessions").select("revoked_at").eq("id", id).maybeSingle();
    // A database hiccup must not sign everyone out: fail open on errors, closed on "not found".
    if (error) return cached?.active ?? true;
    active = !!data && data.revoked_at == null;
    const last = lastTouched.get(id) ?? 0;
    if (active && Date.now() - last > 60_000) {
      lastTouched.set(id, Date.now());
      void sb.from("app_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", id);
    }
  }
  revocationCache.set(id, { active, at: Date.now() });
  return active;
}

/** Records a verified Seeker owner. Returns false when that SGT already verified another wallet. */
export async function dbSaveSeekerVerification(wallet: string, sgtMint: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) {
    for (const [w, m] of localSeekers) if (m === sgtMint && w !== wallet) return false;
    localSeekers.set(wallet, sgtMint);
    return true;
  }
  const { data: existing } = await sb.from("seeker_verifications").select("wallet").eq("sgt_mint", sgtMint).maybeSingle();
  if (existing && existing.wallet !== wallet) return false;
  const { error } = await sb.from("seeker_verifications").upsert({ wallet, sgt_mint: sgtMint, verified_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return true;
}

export async function dbSeekerVerified(wallet: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return localSeekers.has(wallet);
  const { data } = await sb.from("seeker_verifications").select("wallet").eq("wallet", wallet).maybeSingle();
  return !!data;
}
