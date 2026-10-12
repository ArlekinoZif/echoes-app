import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth-server";
import { runtimeEnv } from "@/lib/runtime-env";

// Server-side Solana RPC proxy. The browser never calls the RPC directly — this
// hides the key and avoids CORS. It also protects the upstream from the burst of
// duplicate calls @solana/web3.js makes (balances, blockhash, account polling),
// which otherwise trips the provider's rate limit and triggers a 429 retry storm.
//
// Three defenses:
//   1. Short-TTL cache for idempotent read methods.
//   2. In-flight coalescing — identical concurrent calls share one upstream hit.
//   3. Server-side retry on 429 so the browser rarely sees a rate-limit error.

const RPC_URL =
  process.env.SOLANA_RPC_URL ??
  runtimeEnv("NEXT_PUBLIC_SOLANA_RPC_URL") ??
  "https://api.mainnet-beta.solana.com";

// Read methods safe to cache briefly, with their TTL in ms.
const READ_TTL: Record<string, number> = {
  getbalance: 3000,
  gettokenaccountbalance: 3000,
  gettokenaccountsbyowner: 4000,
  getparsedtokenaccountsbyowner: 4000,
  getaccountinfo: 3000,
  getmultipleaccounts: 3000,
  getlatestblockhash: 1500,
  getblockheight: 2000,
  getslot: 2000,
  gethealth: 5000,
  getgenesishash: 60000,
  getepochinfo: 3000,
};

type Hit = { ts: number; status: number; body: string };
const cache = new Map<string, Hit>();
const inflight = new Map<string, Promise<{ status: number; body: string }>>();

function cacheKeyFor(raw: string): { key: string; ttl: number } | null {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return null; // don't cache batch requests
    const method = String(parsed?.method ?? "").toLowerCase();
    const ttl = READ_TTL[method];
    if (!ttl) return null;
    return { key: `${method}:${JSON.stringify(parsed?.params ?? [])}`, ttl };
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function upstream(body: string): Promise<{ status: number; body: string }> {
  // Retry on 429 (and transient 5xx) with backoff so the browser doesn't storm.
  const delays = [150, 350, 700, 1200];
  let last = { status: 502, body: '{"error":"upstream failed"}' };
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      const text = await res.text();
      last = { status: res.status, body: text };
      if (res.status !== 429 && res.status < 500) return last;
    } catch (err) {
      last = { status: 502, body: JSON.stringify({ error: String(err) }) };
    }
    if (attempt < delays.length) await sleep(delays[attempt]);
  }
  return last;
}

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > 256 * 1024) {
    return NextResponse.json({ error: "RPC request too large" }, { status: 413 });
  }
  const body = await req.text();
  if (body.length > 256 * 1024) {
    return NextResponse.json({ error: "RPC request too large" }, { status: 413 });
  }
  let calls: Array<{ method?: unknown }>;
  try {
    const parsed = JSON.parse(body);
    calls = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return NextResponse.json({ error: "Invalid JSON-RPC request" }, { status: 400 });
  }
  if (!calls.length || calls.some((call) => !call || typeof call.method !== "string")) {
    return NextResponse.json({ error: "Invalid JSON-RPC request" }, { status: 400 });
  }
  const hasWriteOrUncachedCall = calls.some(
    (call) => !READ_TTL[String(call.method).toLowerCase()]
  );
  if (hasWriteOrUncachedCall) {
    try { await requireUser(req); } catch (error) { return authErrorResponse(error); }
  }
  const ck = cacheKeyFor(body);
  const now = Date.now();

  if (ck) {
    const hit = cache.get(ck.key);
    if (hit && now - hit.ts < ck.ttl) {
      return new NextResponse(hit.body, {
        status: hit.status,
        headers: { "Content-Type": "application/json", "X-Rpc-Cache": "hit" },
      });
    }
    // Coalesce concurrent identical requests into a single upstream call.
    let pending = inflight.get(ck.key);
    if (!pending) {
      pending = upstream(body).then((r) => {
        if (r.status === 200) {
          if (cache.size >= 1000) cache.delete(cache.keys().next().value as string);
          cache.set(ck.key, { ts: Date.now(), status: r.status, body: r.body });
        }
        return r;
      }).finally(() => inflight.delete(ck.key));
      inflight.set(ck.key, pending);
    }
    const r = await pending;
    return new NextResponse(r.body, {
      status: r.status,
      headers: { "Content-Type": "application/json", "X-Rpc-Cache": "miss" },
    });
  }

  // Non-cacheable (sendTransaction, getSignatureStatuses, simulate, batch…) —
  // still pass through with 429 absorption.
  const r = await upstream(body);
  return new NextResponse(r.body, {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
