import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import {
  Connection, PublicKey, SystemProgram, Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { dbFetchStory, dbSupportsBuyerUnlocks } from "@/lib/db-server";
import { AuthenticationError, assertOwnIdentity, authErrorResponse, requireUser } from "@/lib/auth-server";
import { runtimeEnv } from "@/lib/runtime-env";

const RPC_URL = runtimeEnv("SOLANA_RPC_URL") ||
  (runtimeEnv("NEXT_PUBLIC_SOLANA_RPC_URL")?.startsWith("http") ? runtimeEnv("NEXT_PUBLIC_SOLANA_RPC_URL") : undefined) ||
  "https://api.mainnet-beta.solana.com";

export async function GET(req: NextRequest) {
  let userId: string;
  try { userId = await requireUser(req); } catch (error) { return authErrorResponse(error); }
  const { searchParams } = new URL(req.url);
  const storyId = searchParams.get("storyId");
  const buyer = searchParams.get("buyer");

  if (!storyId || !buyer) {
    return NextResponse.json({ error: "storyId and buyer required" }, { status: 400 });
  }

  // Refuse before any money moves if the unlock could not be recorded afterwards.
  if (!(await dbSupportsBuyerUnlocks())) {
    return NextResponse.json(
      { error: "Private recordings cannot be unlocked right now. Please try again later." },
      { status: 503 }
    );
  }

  try {
    assertOwnIdentity(userId, buyer);
    const story = await dbFetchStory(storyId);
    if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });
    if (!story.isPrivate || !story.priceSol || !story.authorWallet) {
      return NextResponse.json({ error: "story is not a private paid audio" }, { status: 400 });
    }

    const conn = new Connection(RPC_URL, "confirmed");
    const buyerPk = new PublicKey(buyer);
    const authorPk = new PublicKey(story.authorWallet!);

    const lamports = Math.floor(story.priceSol * LAMPORTS_PER_SOL);
    const { blockhash } = await conn.getLatestBlockhash();

    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: buyerPk });
    tx.add(
      SystemProgram.transfer({ fromPubkey: buyerPk, toPubkey: authorPk, lamports })
    );

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    return NextResponse.json({ transactions: [Buffer.from(serialized).toString("base64")] });
  } catch (err) {
    if (err instanceof AuthenticationError) return authErrorResponse(err);
    return internalError(err, "unlock/tx");
  }
}
