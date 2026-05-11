/**
 * Step 3 of Bags token launch: create the signed launch transaction.
 * Requires the meteoraConfigKey (configKey) from the fee-config step.
 *
 * POST /api/bags/launch-txs
 * Body: { tokenMint, tokenMetadata, wallet, configKey, initialBuyLamports? }
 * Returns: { transaction: string (base64) }
 */

import { NextRequest, NextResponse } from "next/server";
import bs58 from "bs58";

const BAGS_API_URL =
  process.env.BAGS_API_URL ?? "https://public-api-v2.bags.fm/api/v1";
const BAGS_API_KEY = process.env.BAGS_API_KEY ?? "";

export async function POST(req: NextRequest) {
  try {
    const {
      tokenMint,
      tokenMetadata,
      wallet,
      configKey,
      initialBuyLamports = 0,
    } = await req.json();

    if (!tokenMint || !tokenMetadata || !wallet || !configKey) {
      return NextResponse.json(
        { error: "tokenMint, tokenMetadata, wallet and configKey are required" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `${BAGS_API_URL}/token-launch/create-launch-transaction`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": BAGS_API_KEY,
        },
        body: JSON.stringify({
          ipfs: tokenMetadata,
          tokenMint,
          wallet,
          initialBuyLamports,
          configKey,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Bags create-launch-transaction error:", res.status, text);
      return NextResponse.json(
        { error: `Bags API error ${res.status}: ${text}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    if (!data.success) {
      return NextResponse.json(
        { error: data.error ?? data.message ?? JSON.stringify(data) },
        { status: 502 }
      );
    }

    // response may be base58 or base64 encoded
    const rawTx: string = typeof data.response === "string"
      ? data.response
      : (data.response?.transaction ?? data.response?.tx ?? JSON.stringify(data.response));

    let txBase64: string;
    try {
      txBase64 = Buffer.from(bs58.decode(rawTx)).toString("base64");
    } catch {
      txBase64 = rawTx; // already base64
    }

    return NextResponse.json({ transaction: txBase64 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("bags/launch-txs error:", msg);
    return NextResponse.json({ error: `bags/launch-txs: ${msg}` }, { status: 500 });
  }
}
