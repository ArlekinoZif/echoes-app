import { dbSupportsBuyerUnlocks } from "@/lib/db-server";
import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { dbCheckUnlock, dbFetchStory, dbIsUnlockTransactionUsed, dbRecordUnlock } from "@/lib/db-server";
import { AuthenticationError, authErrorResponse, requireUser } from "@/lib/auth-server";
import { verifySolanaTransfer } from "@/lib/solana-payment-server";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export async function GET(req: NextRequest) {
  let buyerId: string;
  try { buyerId = await requireUser(req); } catch (error) { return authErrorResponse(error); }
  const { searchParams } = new URL(req.url);
  const storyId = searchParams.get("storyId");
  const wallet = searchParams.get("wallet");
  if (!storyId || !wallet) return NextResponse.json({ error: "storyId and wallet required" }, { status: 400 });
  try {
    return NextResponse.json({ unlocked: await dbCheckUnlock(storyId, buyerId) });
  } catch (err) {
    return internalError(err, "unlock");
  }
}

export async function POST(req: NextRequest) {
  try {
    const buyerId = await requireUser(req);
    if (!(await dbSupportsBuyerUnlocks())) {
      return NextResponse.json(
        { error: "Private recordings cannot be unlocked right now. Please try again later." },
        { status: 503 }
      );
    }
    const { storyId, wallet, txSig } = await req.json();
    if (!storyId || !wallet || !txSig) return NextResponse.json({ error: "Missing unlock proof" }, { status: 400 });
    const story = await dbFetchStory(storyId);
    if (!story?.isPrivate || !story.priceSol || !story.authorWallet) {
      return NextResponse.json({ error: "Story is not a private paid audio" }, { status: 400 });
    }
    if (await dbIsUnlockTransactionUsed(txSig)) {
      return NextResponse.json({ error: "This payment has already been used" }, { status: 409 });
    }
    await verifySolanaTransfer(
      txSig,
      wallet,
      story.authorWallet,
      Math.floor(story.priceSol * LAMPORTS_PER_SOL),
    );
    await dbRecordUnlock(storyId, buyerId, wallet, txSig);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthenticationError) return authErrorResponse(err);
    return internalError(err, "unlock");
  }
}
