import { NextRequest, NextResponse } from "next/server";

export interface BagsLaunchPayload {
  name: string;
  description: string;
  audioUrl: string;
  arweaveTxId: string;
  category: string;
  authorWallet: string;
}

export interface BagsLaunchResult {
  tokenAddress: string;
  listingUrl: string;
  transactionId: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: BagsLaunchPayload = await req.json();

    const BAGS_API_KEY = process.env.BAGS_API_KEY;
    const BAGS_PARTNER_KEY = process.env.BAGS_PARTNER_KEY;
    const BAGS_REF = process.env.BAGS_REF ?? "sirhitalk";
    const BAGS_API_URL = process.env.BAGS_API_URL ?? "https://api.bags.fm/v1";

    if (!BAGS_API_KEY) {
      return NextResponse.json({
        tokenAddress: `mock_token_${Date.now()}`,
        listingUrl: `https://bags.fm/token/mock_${Date.now()}?ref=${BAGS_REF}`,
        transactionId: `mock_tx_${Date.now()}`,
      } satisfies BagsLaunchResult);
    }

    const res = await fetch(`${BAGS_API_URL}/tokens/launch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BAGS_API_KEY}`,
        ...(BAGS_PARTNER_KEY && { "X-Partner-Key": BAGS_PARTNER_KEY }),
      },
      body: JSON.stringify({
        name: body.name,
        description: body.description,
        audio_url: body.audioUrl,
        arweave_tx_id: body.arweaveTxId,
        category: body.category,
        author_wallet: body.authorWallet,
        ref: BAGS_REF,
        revenue_share: {
          author_bps: 8000,   // 80%
          platform_bps: 2000, // 20%
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Bags API error: ${err}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({
      tokenAddress: data.token_address,
      listingUrl: `${data.listing_url}?ref=${BAGS_REF}`,
      transactionId: data.transaction_id,
    } satisfies BagsLaunchResult);
  } catch (err) {
    console.error("bags-launch error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
