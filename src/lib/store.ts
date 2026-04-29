"use client";

import { Story, Evaluation } from "./types";

const STORIES_KEY = "echoes_stories";
const EVALS_KEY = "echoes_evaluations";

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

// Stories available for evaluation (not authored by current session)
export function getStoriesForEvaluation(excludeId?: string): Story[] {
  return getStories().filter(
    (s) => s.status === "pending_eval" && s.id !== excludeId
  );
}
