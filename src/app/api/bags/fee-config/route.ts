/**
 * Step 2 of Bags token launch: create fee-share configuration.
 * Must happen BEFORE the launch transaction — the meteoraConfigKey it returns
 * is required as the configKey input for the launch transaction.
 *
 * POST /api/bags/fee-config
 * Body: { payer, tokenMint, launchType, authorWallet, sponsorWallet? }
 * Returns: { meteoraConfigKey, transactions: string[] (base64), needsCreation }
 *
 * Fee splits (basis points, must total 10,000):
 *   author  launch → author 75 % (7500 bps) · platform 25 % (2500 bps)
 *   sponsor launch → sponsor 50 % (5000 bps) · author 25 % (2500 bps) · platform 25 % (2500 bps)
 */

import { NextRequest, NextResponse } from "next/server";
import bs58 from "bs58";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { AuthenticationError, assertOwnIdentity, authErrorResponse, requireUser } from "@/lib/auth-server";
import { runtimeEnv } from "@/lib/runtime-env";

const BAGS_API_URL =
  process.env.BAGS_API_URL ?? "https://public-api-v2.bags.fm/api/v1";
const BAGS_API_KEY = process.env.BAGS_API_KEY ?? "";
const PLATFORM_WALLET =
  runtimeEnv("NEXT_PUBLIC_PLATFORM_WALLET") ??
  "7PfDfuoNKzQCCxpRB5B6NFXq6RhuszYYBzbyrLLKkNhB";

function txToBase64(tx: unknown): string {
  let raw: string;
  if (typeof tx === "string") {
    raw = tx;
  } else if (tx && typeof tx === "object") {
    const obj = tx as Record<string, unknown>;
    raw = (obj.tx ?? obj.transaction ?? obj.data ?? obj.serializedTransaction ?? "") as string;
  } else {
    throw new Error(`Unexpected tx format: ${JSON.stringify(tx)}`);
  }
  if (!raw || typeof raw !== "string") throw new Error(`No string found in tx: ${JSON.stringify(tx)}`);
  // Try bs58 → base64; if that fails assume already base64
  try {
    return Buffer.from(bs58.decode(raw)).toString("base64");
  } catch {
    return raw;
  }
}

export async function POST(req: NextRequest) {
  let userId: string;
  try { userId = await requireUser(req); } catch (error) { return authErrorResponse(error); }
  try {
    const { payer, tokenMint, launchType, authorWallet, sponsorWallet } =
      await req.json();

    if (!payer || !tokenMint || !launchType || !authorWallet) {
      return NextResponse.json(
        { error: "payer, tokenMint, launchType and authorWallet are required" },
        { status: 400 }
      );
    }
    assertOwnIdentity(userId, payer);
    if (!BAGS_API_KEY) {
      return NextResponse.json({ error: "Token launch is not configured" }, { status: 503 });
    }

    let claimersArray: string[];
    let basisPointsArray: number[];

    if (launchType === "author") {
      claimersArray = [authorWallet, PLATFORM_WALLET];
      basisPointsArray = [7500, 2500];
    } else {
      if (!sponsorWallet) {
        return NextResponse.json(
          { error: "sponsorWallet required for sponsor launch" },
          { status: 400 }
        );
      }
      claimersArray = [sponsorWallet, authorWallet, PLATFORM_WALLET];
      basisPointsArray = [5000, 2500, 2500];
    }

    const reqBody = {
      payer,
      baseMint: tokenMint,
      claimersArray,
      basisPointsArray,
    };
    console.log("bags/fee-config → sending to", `${BAGS_API_URL}/fee-share/config`, JSON.stringify(reqBody));

    const res = await fetchWithTimeout(`${BAGS_API_URL}/fee-share/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": BAGS_API_KEY,
      },
      body: JSON.stringify(reqBody),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Bags fee-share/config error:", res.status, text);
      return NextResponse.json(
        { error: `Bags API error ${res.status}: ${text}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    console.log("Bags fee-share/config raw response:", JSON.stringify(data));
    if (!data.success) {
      return NextResponse.json(
        { error: data.response ?? data.error ?? "Fee config failed" },
        { status: 502 }
      );
    }

    const {
      meteoraConfigKey,
      transactions,
      bundles,
      needsCreation,
    } = data.response as {
      meteoraConfigKey: string;
      transactions: unknown[] | null;
      bundles: unknown[][] | null;
      needsCreation: boolean;
    };

    // Normalise to base64 so the client can sign uniformly
    const txBase64s: string[] = [];
    if (transactions?.length) {
      for (const t of transactions) txBase64s.push(txToBase64(t));
    }
    if (bundles?.length) {
      for (const bundle of bundles)
        for (const t of bundle) txBase64s.push(txToBase64(t));
    }

    return NextResponse.json({ meteoraConfigKey, transactions: txBase64s, needsCreation });
  } catch (err) {
    if (err instanceof AuthenticationError) return authErrorResponse(err);
    const msg = err instanceof Error ? err.message : String(err);
    console.error("bags/fee-config error:", msg);
    return NextResponse.json({ error: `bags/fee-config: ${msg}` }, { status: 500 });
  }
}
