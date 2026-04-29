/**
 * Step 2 of Bags token launch: get unsigned launch transactions.
 * The client signs + sends these with Phantom.
 *
 * POST /api/bags/launch-txs
 * Body: { tokenInfoId, creatorWallet }
 * Returns: { transactions: string[], mint: string }
 *   transactions — base64-encoded unsigned Solana transactions
 *   mint         — the token mint address (may be empty until first tx confirms)
 */

import { NextRequest, NextResponse } from "next/server";

const BAGS_API_URL =
  process.env.BAGS_API_URL ?? "https://public-api-v2.bags.fm/api/v1";
const BAGS_API_KEY = process.env.BAGS_API_KEY ?? "";
const BAGS_REF = process.env.BAGS_REF ?? "sirhitalk";

export async function POST(req: NextRequest) {
  try {
    const { tokenInfoId, creatorWallet } = await req.json();

    if (!tokenInfoId || !creatorWallet) {
      return NextResponse.json(
        { error: "tokenInfoId and creatorWallet are required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${BAGS_API_URL}/launch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": BAGS_API_KEY,
      },
      body: JSON.stringify({
        tokenInfoId,
        creatorWallet,
        ref: BAGS_REF,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Bags /launch error:", res.status, text);
      return NextResponse.json(
        { error: `Bags API error ${res.status}: ${text}` },
        { status: 502 }
      );
    }

    const data = await res.json();

    // Normalise: Bags may use different shapes
    const transactions: string[] =
      data.transactions ??
      data.unsignedTransactions ??
      (data.transaction ? [data.transaction] : []);
    const mint: string =
      data.mint ?? data.mintAddress ?? data.token_mint ?? "";

    return NextResponse.json({ transactions, mint });
  } catch (err) {
    console.error("bags/launch-txs error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
