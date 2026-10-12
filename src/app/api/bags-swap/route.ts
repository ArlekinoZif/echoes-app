/**
 * Bags trading proxy for story tokens.
 *
 * GET  /api/bags-swap?action=quote&inputMint&outputMint&amount&slippage
 *      Returns the Bags quote response.
 * POST /api/bags-swap  { quoteResponse, userPublicKey }
 *      Returns { swapTransaction } as base64 for the wallet to sign.
 *
 * The swap transaction is built for the authenticated wallet only, so a session
 * cannot request a transaction payable by somebody else.
 */
import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import bs58 from "bs58";
import { bagsFetch } from "@/lib/bags-fetch";
import { assertOwnIdentity, authErrorResponse, requireUser } from "@/lib/auth-server";

const BAGS_API_URL = process.env.BAGS_API_URL ?? "https://public-api-v2.bags.fm/api/v1";
const BAGS_API_KEY = process.env.BAGS_API_KEY ?? "";

const headers = () => ({ "Content-Type": "application/json", "x-api-key": BAGS_API_KEY });

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  if (params.get("action") !== "quote") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  const inputMint = params.get("inputMint") ?? "";
  const outputMint = params.get("outputMint") ?? "";
  const amount = params.get("amount") ?? "";
  const slippageBps = params.get("slippage") ?? "100";

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { error: "inputMint, outputMint and amount are required" },
      { status: 400 }
    );
  }
  if (!BAGS_API_KEY) {
    return NextResponse.json({ error: "Bags API key is not configured" }, { status: 503 });
  }

  try {
    const url =
      `${BAGS_API_URL}/trade/quote?inputMint=${encodeURIComponent(inputMint)}` +
      `&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}` +
      `&slippageBps=${encodeURIComponent(slippageBps)}`;
    const res = await bagsFetch(url, { headers: headers() });
    const json = await res.json();

    if (!res.ok || !json.success) {
      const message = json?.response ?? json?.error ?? `Bags quote error ${res.status}`;
      // A failed quote is a normal outcome for an illiquid token, so the client
      // renders the message instead of treating it as a transport failure.
      return NextResponse.json({ error: String(message) }, { status: 200 });
    }
    return NextResponse.json(json.response);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  let userId: string;
  try { userId = await requireUser(req); } catch (error) { return authErrorResponse(error); }

  try {
    const { quoteResponse, userPublicKey } = await req.json();
    if (!quoteResponse || !userPublicKey) {
      return NextResponse.json(
        { error: "quoteResponse and userPublicKey are required" },
        { status: 400 }
      );
    }
    try { assertOwnIdentity(userId, userPublicKey); } catch (error) { return authErrorResponse(error); }
    if (!BAGS_API_KEY) {
      return NextResponse.json({ error: "Bags API key is not configured" }, { status: 503 });
    }

    const res = await bagsFetch(`${BAGS_API_URL}/trade/swap`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ quoteResponse, userPublicKey }),
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      const message = json?.response ?? json?.error ?? `Bags swap error ${res.status}`;
      return NextResponse.json({ error: String(message) }, { status: 502 });
    }

    const swapTransaction: string = json.response?.swapTransaction ?? "";
    if (!swapTransaction) {
      return NextResponse.json({ error: "No swap transaction returned" }, { status: 502 });
    }

    // Bags returns base58; wallets in this app expect base64.
    let encoded: string;
    try {
      encoded = Buffer.from(bs58.decode(swapTransaction)).toString("base64");
    } catch {
      encoded = swapTransaction;
    }
    return NextResponse.json({ swapTransaction: encoded });
  } catch (error) {
    return internalError(error, "bags-swap");
  }
}
