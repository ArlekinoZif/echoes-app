// Weekly pool schedule and economics.
//
// The pool is a fixed weekly cycle counted from 2024-01-01 UTC: six days of
// blind voting followed by a one-day reveal window. Everything else comes from
// the environment so a round can be tuned without a code change.

import { runtimeEnv } from "@/lib/runtime-env";

const EPOCH = Math.floor(Date.UTC(2024, 0, 1) / 1000);
const WEEK = 604800;
const VOTE_WINDOW = 518400; // 6 days

export interface PoolConfig {
  poolId: number;
  voteOpenAt: number;
  voteCloseAt: number;
  revealCloseAt: number;
  voteCost: number; // $ECHOES per vote; 0 disables the minimum
  solPrize: number;
}

export type PoolPhase = "voting" | "reveal" | "finalized";

export function getPoolConfig(now = Math.floor(Date.now() / 1000)): PoolConfig {
  const poolId = Math.max(0, Math.floor((now - EPOCH) / WEEK));
  const voteOpenAt = EPOCH + WEEK * poolId;
  return {
    poolId,
    voteOpenAt,
    voteCloseAt: voteOpenAt + VOTE_WINDOW,
    revealCloseAt: voteOpenAt + WEEK,
    voteCost: Number(runtimeEnv("NEXT_PUBLIC_POOL_VOTE_COST") ?? "0"),
    solPrize: Number(runtimeEnv("NEXT_PUBLIC_POOL_SOL_PRIZE") ?? "0"),
  };
}

export function getPoolPhase(config: PoolConfig, now = Math.floor(Date.now() / 1000)): PoolPhase {
  if (now < config.voteCloseAt) return "voting";
  if (now < config.revealCloseAt) return "reveal";
  return "finalized";
}

/** How many published stories compete in one round. */
export const POOL_MAX_ENTRIES = Number(runtimeEnv("NEXT_PUBLIC_POOL_MAX_ENTRIES") ?? "20");

/** Minimum SKR staked in Seeker required to vote; 0 disables the gate. */
export const MIN_STAKED_SKR = Number(runtimeEnv("NEXT_PUBLIC_MIN_STAKED_SKR") ?? "0");
