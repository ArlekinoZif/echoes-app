/**
 * Step 1 of Bags token launch: create token info + upload metadata to IPFS.
 * Uses multipart/form-data as required by the Bags API.
 *
 * POST /api/bags/info
 * Body (JSON): { name, symbol, description, imageBase64?, imageUrl? }
 * Returns: { tokenMint, tokenMetadata }
 *   tokenMint     — the pre-determined token mint address
 *   tokenMetadata — IPFS URL of the token metadata (needed for launch tx)
 */

import { NextRequest, NextResponse } from "next/server";

const BAGS_API_URL =
  process.env.BAGS_API_URL ?? "https://public-api-v2.bags.fm/api/v1";
const BAGS_API_KEY = process.env.BAGS_API_KEY ?? "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, symbol, description, imageBase64, imageUrl, twitter } = body;

    if (!name || !symbol || !description) {
      return NextResponse.json(
        { error: "name, symbol and description are required" },
        { status: 400 }
      );
    }

    const formData = new FormData();
    formData.append("name", String(name).slice(0, 32));
    formData.append("symbol", String(symbol).toUpperCase().slice(0, 10));
    formData.append("description", String(description).slice(0, 1000));
    if (twitter) formData.append("twitter", String(twitter));

    if (imageUrl) {
      formData.append("imageUrl", imageUrl);
    } else if (imageBase64) {
      const match = (imageBase64 as string).match(/^data:(.+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const buf = Buffer.from(match[2], "base64");
        const blob = new Blob([buf], { type: mimeType });
        formData.append("image", blob, "cover.jpg");
      }
    }

    const res = await fetch(
      `${BAGS_API_URL}/token-launch/create-token-info`,
      {
        method: "POST",
        headers: { "x-api-key": BAGS_API_KEY },
        body: formData,
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Bags create-token-info error:", res.status, text);
      return NextResponse.json(
        { error: `Bags API error ${res.status}: ${text}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    if (!data.success) {
      return NextResponse.json(
        { error: data.error ?? "Token info failed" },
        { status: 502 }
      );
    }

    const { tokenMint, tokenMetadata } = data.response as {
      tokenMint: string;
      tokenMetadata: string;
    };

    return NextResponse.json({ tokenMint, tokenMetadata });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("bags/info error:", msg);
    return NextResponse.json({ error: `bags/info: ${msg}` }, { status: 500 });
  }
}
