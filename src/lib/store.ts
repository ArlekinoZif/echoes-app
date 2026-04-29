"use client";

import { Story, Evaluation } from "./types";

const STORIES_KEY = "echoes_stories";
const EVALS_KEY = "echoes_evaluations";
const FAVS_KEY = "echoes_favourites";

// ── Stories ────────────────────────────────────────────────────────────────

export function saveStory(story: Story): void {
  const stories = getStories();
  const idx = stories.findIndex((s) => s.id === story.id);
  if (idx >= 0) stories[idx] = story;
  else stories.push(story);
  localStorage.setItem(STORIES_KEY, JSON.stringify(stories));
}

export function getStories(): Story[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORIES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function getStory(id: string): Story | undefined {
  return getStories().find((s) => s.id === id);
}

/** Stories waiting to be evaluated (pending_eval gate). */
export function getStoriesForEvaluation(excludeId?: string): Story[] {
  return getStories().filter(
    (s) => s.status === "pending_eval" && s.id !== excludeId
  );
}

/** Listed stories that have NOT been tokenized yet — available for sponsoring. */
export function getStoriesForSponsor(myWallet?: string | null): Story[] {
  return getStories().filter(
    (s) =>
      s.status === "listed" &&
      !s.tokenMint &&
      // Exclude the current user's own stories (they should author-launch, not sponsor)
      (!myWallet || s.authorWallet !== myWallet)
  );
}

/** All public stories (listed + tokenized) — the Records Library feed. */
export function getPublicStories(): Story[] {
  return getStories()
    .filter((s) => s.status === "listed" || s.status === "tokenized")
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ── Evaluations ────────────────────────────────────────────────────────────

export function saveEvaluation(evaluation: Evaluation): void {
  const evals = getEvaluations();
  const idx = evals.findIndex((e) => e.storyId === evaluation.storyId);
  if (idx >= 0) evals[idx] = evaluation;
  else evals.push(evaluation);
  localStorage.setItem(EVALS_KEY, JSON.stringify(evals));
}

export function getEvaluations(): Evaluation[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(EVALS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function getEvaluationsForStory(storyId: string): Evaluation[] {
  return getEvaluations().filter((e) => e.storyId === storyId);
}

// ── Favourites ─────────────────────────────────────────────────────────────

export function getFavourites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(FAVS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function toggleFavourite(storyId: string): boolean {
  const favs = getFavourites();
  const idx = favs.indexOf(storyId);
  if (idx >= 0) {
    favs.splice(idx, 1);
    localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
    return false; // removed
  } else {
    favs.push(storyId);
    localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
    return true; // added
  }
}

export function isFavourite(storyId: string): boolean {
  return getFavourites().includes(storyId);
}
