// Bags rate-limits aggressively and occasionally returns 5xx, so every call goes
// through a bounded retry with exponential backoff and full jitter. A 429 is
// retried after the interval the response asks for, when it gives one.

import { fetchWithTimeout } from "@/lib/fetch-timeout";

const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 6000;
const RETRY_STATUSES = new Set([429, 500, 502, 503]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number) {
  return Math.floor(Math.random() * Math.min(500 * 2 ** (attempt - 1), MAX_BACKOFF_MS));
}

function retryAfterMs(res: Response): number | null {
  const retryAfter = res.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(seconds * 1000, MAX_BACKOFF_MS);
  }
  const reset = res.headers.get("x-ratelimit-reset");
  if (reset) {
    const waitMs = Number(reset) * 1000 - Date.now();
    if (Number.isFinite(waitMs) && waitMs > 0) return Math.min(waitMs, MAX_BACKOFF_MS);
  }
  return null;
}

export async function bagsFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = 30000
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);
      if (RETRY_STATUSES.has(res.status) && attempt < MAX_ATTEMPTS) {
        const wait = res.status === 429 ? retryAfterMs(res) ?? backoffMs(attempt) : backoffMs(attempt);
        console.warn(`[bags] ${res.status} on ${url} — retry ${attempt}/${MAX_ATTEMPTS - 1} in ${wait}ms`);
        await sleep(wait);
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        const wait = backoffMs(attempt);
        console.warn(`[bags] network error on ${url} — retry ${attempt}/${MAX_ATTEMPTS - 1} in ${wait}ms`);
        await sleep(wait);
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Bags request failed after retries");
}
