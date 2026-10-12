import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { AuthenticationError, assertOwnIdentity, authErrorResponse, requireUser } from "@/lib/auth-server";
import { runtimeEnv } from "@/lib/runtime-env";

const JUP_BASE = "https://api.jup.ag";
const API_KEY = runtimeEnv("NEXT_PUBLIC_JUPITER_API_KEY") ?? "";

const headers = () => ({
  "Content-Type": "application/json",
  ...(API_KEY ? { "x-api-key": API_KEY } : {}),
});

// GET /api/jupiter-swap?action=quote&inputMint=...&outputMint=...&amount=...&slippage=...
// GET /api/jupiter-swap?action=price&ids=...
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const action = searchParams.get("action");

  if (action === "price") {
    const ids = searchParams.get("ids") ?? "";
    const res = await fetch(`${JUP_BASE}/price/v2?ids=${ids}`, { headers: headers() });
    const data = await res.json();
    return NextResponse.json(data);
  }

  if (action === "quote") {
    const inputMint = searchParams.get("inputMint")!;
    const outputMint = searchParams.get("outputMint")!;
    const amount = searchParams.get("amount")!; // in lamports
    const slippage = searchParams.get("slippage") ?? "50"; // bps
    const url = `${JUP_BASE}/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage}&restrictIntermediateTokens=true`;
    const res = await fetch(url, { headers: headers() });
    const data = await res.json();
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

// POST /api/jupiter-swap  body: { quoteResponse, userPublicKey }
export async function POST(req: NextRequest) {
  let userId: string;
  try { userId = await requireUser(req); } catch (error) { return authErrorResponse(error); }
  try {
    const body = await req.json();
    assertOwnIdentity(userId, body.userPublicKey);
    const res = await fetch(`${JUP_BASE}/swap/v1/swap`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        quoteResponse: body.quoteResponse,
        userPublicKey: body.userPublicKey,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
        prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 1000000, priorityLevel: "veryHigh" } },
      }),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AuthenticationError) return authErrorResponse(err);
    return internalError(err, "jupiter-swap");
  }
}
