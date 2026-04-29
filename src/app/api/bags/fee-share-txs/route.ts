/**
 * Step 3 of Bags token launch: configure revenue split.
 * The client signs + sends these transactions with Phantom.
 *
 * POST /api/bags/fee-share-txs
 * Body: {
 *   mint: string,
 *   launchType: "author" | "sponsor",
 *   authorWallet: string,
 *   sponsorWallet?: string   // required when launchType === "sponsor"
 * }
 * Returns: { transactions: string[] }
 *
 * Fee splits:
 *   author  launch → author 75 %, platform 25 %
 *   sponsor launch → sponsor 50 %, author 25 %, platform 25 %
 */

import { NextRequest, NextResponse } from "next/server";

const BAGS_API_URL =
  process.env.BAGS_API_URL ?? "https://public-api-v2.bags.fm/api/v1";
const BAGS_API_KEY = process.env.BAGS_API_KEY ?? "";

const PLATFORM_WALLET =
  process.env.NEXT_PUBLIC_PLATFORM_WALLET ??
  "7PfDfuoNKzQCCxpRB5B6NFXq6RhuszYYBzbyrLLKkNhB";

export async function POST(req: NextRequest) {
  try {
    const { mint, launchType, authorWallet, sponsorWallet } = await req.json();

    if (!mint || !launchType || !authorWallet) {
      return NextResponse.json(
        { error: "mint, launchType and authorWallet are required" },
        { status: 400 }
      );
    }

    if (launchType === "sponsor" && !sponsorWallet) {
      return NextResponse.json(
        { error: "sponsorWallet is required for sponsor launches" },
        { status: 400 }
      );
    }

    type Recipient = { wallet: string; bps: number };
    let feeRecipients: Recipient[];

    if (launchType === "author") {
      feeRecipients = [
        { wallet: authorWallet, bps: 7500 },   // 75 %
        { wallet: PLATFORM_WALLET, bps: 2500 }, // 25 %
      ];
    } else {
      feeRecipients = [
        { wallet: sponsorWallet!, bps: 5000 },  // 50 %
        { wallet: authorWallet, bps: 2500 },    // 25 %
        { wallet: PLATFORM_WALLET, bps: 2500 }, // 25 %
      ];
    }

    const res = await fetch(`${BAGS_API_URL}/fee-share/config/v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": BAGS_API_KEY,
      },
      body: JSON.stringify({ mint, feeRecipients }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Bags /fee-share/config/v2 error:", res.status, text);
      return NextResponse.json(
        { error: `Bags API error ${res.status}: ${text}` },
        { status: 502 }
      );
    }

    const data = await res.json();

    const transactions: string[] =
      data.transactions ??
      data.unsignedTransactions ??
      (data.transaction ? [data.transaction] : []);

    return NextResponse.json({ transactions });
  } catch (err) {
    console.error("bags/fee-share-txs error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
