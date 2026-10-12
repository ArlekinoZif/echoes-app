"use client";

// Client-side DB layer — calls Next.js API routes backed by Cloudflare D1
// No direct DB access from the browser

import { Story, Evaluation } from "./types";
import { authenticatedFetch } from "./authenticated-fetch";

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await authenticatedFetch(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ── Stories ───────────────────────────────────────────────────────────────────

export function fetchStory(id: string): Promise<Story | null> {
  return api<Story>(`/api/stories/${id}`).catch(() => null);
}

export function fetchPublicStories(): Promise<Story[]> {
  return api("/api/stories?type=public");
}

export function fetchTopStories(): Promise<Story[]> {
  return api("/api/stories?type=top");
}

export function fetchStoriesForEvaluation(): Promise<Story[]> {
  return api("/api/stories?type=evaluate");
}

export function fetchStoriesForSponsor(wallet?: string | null): Promise<Story[]> {
  const q = wallet ? `&wallet=${encodeURIComponent(wallet)}` : "";
  return api(`/api/stories?type=sponsor${q}`);
}

export function fetchMyStories(wallet: string): Promise<Story[]> {
  return api(`/api/stories?type=mine&wallet=${encodeURIComponent(wallet)}`);
}

export function upsertStory(story: Story): Promise<void> {
  return api("/api/stories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(story),
  });
}

// ── Evaluations ───────────────────────────────────────────────────────────────

export function fetchMyEvaluatedIds(wallet: string): Promise<string[]> {
  return api(`/api/evaluations?wallet=${encodeURIComponent(wallet)}`);
}

export function upsertEvaluation(evaluation: Evaluation, evaluatorWallet: string): Promise<void> {
  return api("/api/evaluations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evaluation, evaluatorWallet }),
  });
}

// ── Favourites ────────────────────────────────────────────────────────────────

export function fetchFavourites(wallet: string): Promise<string[]> {
  return api(`/api/favourites?wallet=${encodeURIComponent(wallet)}`);
}

export async function toggleFavouriteDb(storyId: string, wallet: string): Promise<boolean> {
  const result = await api<{ isFav: boolean }>("/api/favourites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storyId, wallet }),
  });
  return result.isFav;
}

// ── Private unlocks ───────────────────────────────────────────────────────────

export async function checkUnlock(storyId: string, wallet: string): Promise<boolean> {
  const result = await api<{ unlocked: boolean }>(
    `/api/unlock?storyId=${encodeURIComponent(storyId)}&wallet=${encodeURIComponent(wallet)}`
  );
  return result.unlocked;
}

export function recordUnlock(storyId: string, wallet: string, txSig: string): Promise<void> {
  return api("/api/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storyId, wallet, txSig }),
  });
}
