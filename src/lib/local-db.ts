// Local JSON file-based database — used as fallback when Supabase is unreachable.
// Stores data in .data/local.json in the project root.
// All operations are synchronous file I/O — acceptable for a fallback path.

import fs from "fs";
import path from "path";
import { Story, Evaluation } from "./types";
import { UserProfile } from "./db-server";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "local.json");

interface LocalStore {
  stories: Record<string, Story & { created_at: number }>;
  evaluations: Array<{
    story_id: string;
    evaluator_wallet: string;
    audio_quality: number;
    storytelling: number;
    description_accuracy: number;
    listened_percent: number;
  }>;
  favourites: Array<{ wallet: string; story_id: string }>;
  user_profiles: Record<string, UserProfile & { referral_code?: string; referral_split?: number }>;
  private_unlocks: Array<{ story_id: string; buyer_id?: string; wallet: string; tx_sig: string }>;
  reports: Array<{
    id: string;
    story_id: string;
    reporter_id: string;
    reason: string;
    details?: string;
    created_at: number;
  }>;
  pool_ballots: Array<{
    pool_id: number;
    voter: string;
    commitment: string;
    echoes_amount: number;
    revealed: boolean;
    story_id?: string | null;
  }>;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function read(): LocalStore {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    return { stories: {}, evaluations: [], favourites: [], user_profiles: {}, private_unlocks: [], pool_ballots: [], reports: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")) as Partial<LocalStore>;
    return {
      stories: {}, evaluations: [], favourites: [], user_profiles: {},
      private_unlocks: [], pool_ballots: [], reports: [],
      ...parsed,
    } as LocalStore;
  } catch {
    return { stories: {}, evaluations: [], favourites: [], user_profiles: {}, private_unlocks: [], pool_ballots: [], reports: [] };
  }
}

function write(store: LocalStore) {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
}

// ── Stories ───────────────────────────────────────────────────────────────────

export function localUpsertStory(story: Story): void {
  const store = read();
  store.stories[story.id] = { ...story, created_at: story.createdAt ?? Date.now() };
  write(store);
}

export function localFetchStory(id: string): Story | null {
  const row = read().stories[id];
  return row ?? null;
}

export function localFetchStoryByAudioUrl(audioUrl: string): Story | null {
  return Object.values(read().stories).find((story) => story.audioBlobUrl === audioUrl) ?? null;
}

export function localFetchPublicStories(): Story[] {
  const store = read();
  return Object.values(store.stories)
    .filter((s) => s.status === "listed" || s.status === "tokenized")
    .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
    .slice(0, 200);
}

export function localFetchTopStories(limit = 5): Story[] {
  const store = read();
  const evalCounts: Record<string, number> = {};
  for (const e of store.evaluations) {
    evalCounts[e.story_id] = (evalCounts[e.story_id] ?? 0) + 1;
  }
  return Object.values(store.stories)
    .filter((s) => s.status === "listed" || s.status === "tokenized")
    .sort((a, b) => (evalCounts[b.id] ?? 0) - (evalCounts[a.id] ?? 0) || (b.created_at ?? 0) - (a.created_at ?? 0))
    .slice(0, limit);
}

export function localFetchStoriesForEvaluation(): Story[] {
  const store = read();
  return Object.values(store.stories)
    .filter((s) => s.status === "pending_eval" || s.status === "listed" || s.status === "tokenized")
    .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
    .slice(0, 100);
}

export function localFetchStoriesForSponsor(myId?: string | null): Story[] {
  const store = read();
  return Object.values(store.stories).filter((s) => {
    if (s.status !== "listed" || s.tokenMint) return false;
    if (myId && s.ownerId === myId) return false;
    return true;
  });
}

export function localFetchMyStories(ownerId: string): Story[] {
  const store = read();
  return Object.values(store.stories)
    .filter((s) => s.ownerId === ownerId)
    .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
}

export function localIsListingTransactionUsed(signature: string, exceptStoryId?: string): boolean {
  return Object.values(read().stories).some(
    (story) => story.listingTxSig === signature && story.id !== exceptStoryId
  );
}

// ── Evaluations ───────────────────────────────────────────────────────────────

export function localUpsertEvaluation(evaluation: Evaluation, evaluatorWallet: string): void {
  const store = read();
  const idx = store.evaluations.findIndex(
    (e) => e.story_id === evaluation.storyId && e.evaluator_wallet === evaluatorWallet
  );
  const row = {
    story_id: evaluation.storyId,
    evaluator_wallet: evaluatorWallet,
    audio_quality: evaluation.criteria.audioQuality,
    storytelling: evaluation.criteria.storytelling,
    description_accuracy: evaluation.criteria.descriptionAccuracy,
    listened_percent: evaluation.listenedPercent,
  };
  if (idx >= 0) store.evaluations[idx] = row;
  else store.evaluations.push(row);

  // Auto-promote after 3 evals
  const count = store.evaluations.filter((e) => e.story_id === evaluation.storyId).length;
  if (count >= 3 && store.stories[evaluation.storyId]?.status === "pending_eval") {
    store.stories[evaluation.storyId].status = "listed";
  }
  write(store);
}

export function localFetchMyEvaluatedIds(wallet: string): string[] {
  return read().evaluations.filter((e) => e.evaluator_wallet === wallet).map((e) => e.story_id);
}

// ── Favourites ────────────────────────────────────────────────────────────────

export function localFetchFavourites(wallet: string): string[] {
  return read().favourites.filter((f) => f.wallet === wallet).map((f) => f.story_id);
}

export function localToggleFavourite(storyId: string, wallet: string): boolean {
  const store = read();
  const idx = store.favourites.findIndex((f) => f.wallet === wallet && f.story_id === storyId);
  if (idx >= 0) {
    store.favourites.splice(idx, 1);
    write(store);
    return false;
  }
  store.favourites.push({ wallet, story_id: storyId });
  write(store);
  return true;
}

// ── User Profiles ─────────────────────────────────────────────────────────────

export function localUpsertProfile(profile: UserProfile): void {
  const store = read();
  const existing = store.user_profiles[profile.wallet] ?? {};
  store.user_profiles[profile.wallet] = {
    ...existing,
    ...profile,
    referral_code: existing.referral_code ?? Math.random().toString(36).slice(2, 8).toUpperCase(),
  };
  write(store);
}

export function localFetchProfile(wallet: string): UserProfile | null {
  return read().user_profiles[wallet] ?? null;
}

// ── Private unlocks ───────────────────────────────────────────────────────────

export function localCheckUnlock(storyId: string, buyerId: string): boolean {
  return read().private_unlocks.some((u) => u.story_id === storyId && u.buyer_id === buyerId);
}

export function localIsUnlockTransactionUsed(txSig: string): boolean {
  return read().private_unlocks.some((u) => u.tx_sig === txSig);
}

export function localRecordUnlock(storyId: string, buyerId: string, wallet: string, txSig: string): void {
  const store = read();
  if (!store.private_unlocks.some((u) => u.story_id === storyId && u.buyer_id === buyerId)) {
    store.private_unlocks.push({ story_id: storyId, buyer_id: buyerId, wallet, tx_sig: txSig });
    write(store);
  }
}

// ── Profiles (batch) and referrals ────────────────────────────────────────────

export function localFetchProfiles(wallets: string[]): UserProfile[] {
  const store = read();
  return wallets.map((w) => store.user_profiles[w]).filter(Boolean) as UserProfile[];
}

export function localCountReferrals(code: string): number {
  return Object.values(read().user_profiles).filter((p) => p.referredBy === code).length;
}

// ── Weekly pool ballots ───────────────────────────────────────────────────────

export interface LocalBallot {
  pool_id: number;
  voter: string;
  commitment: string;
  echoes_amount: number;
  revealed: boolean;
  story_id?: string | null;
}

export function localFetchBallots(poolId: number): LocalBallot[] {
  return read().pool_ballots.filter((b) => b.pool_id === poolId);
}

export function localFetchBallot(poolId: number, voter: string): LocalBallot | null {
  return read().pool_ballots.find((b) => b.pool_id === poolId && b.voter === voter) ?? null;
}

export function localSaveBallot(
  poolId: number,
  voter: string,
  commitment: string,
  echoesAmount: number
): { ok: boolean; reason?: "already_voted" } {
  const store = read();
  if (store.pool_ballots.some((b) => b.pool_id === poolId && b.voter === voter)) {
    return { ok: false, reason: "already_voted" };
  }
  store.pool_ballots.push({
    pool_id: poolId,
    voter,
    commitment,
    echoes_amount: echoesAmount,
    revealed: false,
    story_id: null,
  });
  write(store);
  return { ok: true };
}

export function localRevealBallot(poolId: number, voter: string, storyId: string): void {
  const store = read();
  const ballot = store.pool_ballots.find((b) => b.pool_id === poolId && b.voter === voter);
  if (!ballot) return;
  ballot.revealed = true;
  ballot.story_id = storyId;
  write(store);
}

// ── Content reports ───────────────────────────────────────────────────────────

export interface LocalReport {
  id: string;
  story_id: string;
  reporter_id: string;
  reason: string;
  details?: string;
  created_at: number;
}

export function localInsertReport(report: LocalReport): void {
  const store = read();
  store.reports.push(report);
  write(store);
}

export function localHasReported(storyId: string, reporterId: string): boolean {
  return read().reports.some((r) => r.story_id === storyId && r.reporter_id === reporterId);
}

// ── Account deletion ──────────────────────────────────────────────────────────

export function localDeleteAccount(userId: string): void {
  const store = read();
  delete store.user_profiles[userId];
  store.favourites = store.favourites.filter((f) => f.wallet !== userId);
  store.evaluations = store.evaluations.filter((e) => e.evaluator_wallet !== userId);
  store.reports = store.reports.filter((r) => r.reporter_id !== userId);
  for (const [id, story] of Object.entries(store.stories)) {
    if (story.ownerId !== userId) continue;
    if (story.tokenMint) {
      // A tokenised story exists on-chain and cannot be withdrawn; strip the
      // personal identifiers instead.
      story.ownerId = undefined;
      story.authorTwitter = undefined;
    } else {
      delete store.stories[id];
    }
  }
  write(store);
}
