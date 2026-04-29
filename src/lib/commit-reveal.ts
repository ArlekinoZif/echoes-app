"use client";

// Client-side commit-reveal helpers (mirrors the on-chain keccak logic)

export function generateSalt(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function computeCommitment(
  storyId: string,
  voterAddress: string,
  salt: string
): Promise<string> {
  const preimage = storyId + voterAddress + salt;
  const encoded = new TextEncoder().encode(preimage);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SALT_KEY = "echoes_vote_salts";

export function saveSalt(poolId: number, storyId: string, salt: string): void {
  const existing = JSON.parse(localStorage.getItem(SALT_KEY) ?? "{}");
  existing[`${poolId}:${storyId}`] = salt;
  localStorage.setItem(SALT_KEY, JSON.stringify(existing));
}

export function getSalt(poolId: number, storyId: string): string | null {
  const existing = JSON.parse(localStorage.getItem(SALT_KEY) ?? "{}");
  return existing[`${poolId}:${storyId}`] ?? null;
}
