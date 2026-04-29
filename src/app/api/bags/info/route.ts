/**
 * Step 1 of Bags token launch: create token info.
 * Called server-side so the API key stays secret.
 *
 * POST /api/bags/info
 * Body: { name, symbol, description, imageBase64?, imageUrl?, arweaveUrl? }
 * Returns: { tokenInfoId }
 */

import { NextRequest, NextResponse } from "next/server";

const BAGS_API_URL =
  process.env.BAGS_API_URL ?? "https://public-api-v2.bags.fm/api/v1";
const BAGS_API_KEY = process.env.BAGS_API_KEY ?? "";
const BAGS_REF = process.env.BAGS_REF ?? "sirhitalk";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, symbol, description, imageBase64, imageUrl, arweaveUrl } = body;

    if (!name || !symbol || !description) {
      return NextResponse.json(
        { error: "name, symbol and description are required" },
        { status: 400 }
      );
    }

    const payload: Record<string, unknown> = {
      name,
      symbol: symbol.toUpperCase(),
      description,
      ref: BAGS_REF,
    };

    // Image: prefer URL over base64
    if (imageUrl) payload.image = imageUrl;
    else if (imageBase64) payload.image = imageBase64;

    // Arweave audio link as external_url
    if (arweaveUrl) payload.external_url = arweaveUrl;

    const res = await fetch(`${BAGS_API_URL}/create-token-info`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": BAGS_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Bags /create-token-info error:", res.status, text);
      return NextResponse.json(
        { error: `Bags API error ${res.status}: ${text}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    // Bags returns id or tokenInfoId depending on API version
    const tokenInfoId: string = data.id ?? data.tokenInfoId ?? data.token_info_id;

    return NextResponse.json({ tokenInfoId });
  } catch (err) {
    console.error("bags/info error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
