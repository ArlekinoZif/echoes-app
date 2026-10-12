/**
 * Builds the unsigned 2400 $ECHOES listing payment.
 *
 * The web client assembles this transaction in the browser. Native clients must
 * not carry a transaction-building stack, and more importantly the amount and
 * recipient should not be decided on a device, so the server builds it here and
 * the wallet only signs. `POST /api/stories` still verifies the resulting
 * signature on-chain before a story becomes listed.
 *
 * GET /api/listing/tx?wallet=<payer>
 * Returns: { transactions: [base64] }
 */
import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { AuthenticationError, assertOwnIdentity, authErrorResponse, requireUser } from "@/lib/auth-server";
import { runtimeEnv } from "@/lib/runtime-env";

const ECHOES_MINT = new PublicKey(
  runtimeEnv("NEXT_PUBLIC_ECHOES_TOKEN_MINT") ?? "8F2N1Da9z1arxiFKmTzxaKoX1yUjJ2xKFQBxxMjQBAGS"
);
const PLATFORM_WALLET = new PublicKey(
  runtimeEnv("NEXT_PUBLIC_PLATFORM_WALLET") ?? "7PfDfuoNKzQCCxpRB5B6NFXq6RhuszYYBzbyrLLKkNhB"
);
const ECHOES_DECIMALS = 9;
const LISTING_FEE_ECHOES = 2400;

function rpcUrl() {
  const publicUrl = runtimeEnv("NEXT_PUBLIC_SOLANA_RPC_URL");
  return (
    runtimeEnv("SOLANA_RPC_URL") ||
    (publicUrl?.startsWith("http") ? publicUrl : undefined) ||
    "https://api.mainnet-beta.solana.com"
  );
}

export async function GET(req: NextRequest) {
  let userId: string;
  try { userId = await requireUser(req); } catch (error) { return authErrorResponse(error); }

  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });

  try {
    assertOwnIdentity(userId, wallet);

    const connection = new Connection(rpcUrl(), "confirmed");
    const mintInfo = await connection.getAccountInfo(ECHOES_MINT);
    const tokenProgramId = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;

    const sender = new PublicKey(wallet);
    const senderAta = getAssociatedTokenAddressSync(ECHOES_MINT, sender, false, tokenProgramId);
    const platformAta = getAssociatedTokenAddressSync(ECHOES_MINT, PLATFORM_WALLET, false, tokenProgramId);

    const instructions: TransactionInstruction[] = [];
    if (!(await connection.getAccountInfo(platformAta))) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          sender, platformAta, PLATFORM_WALLET, ECHOES_MINT,
          tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }
    instructions.push(
      createTransferInstruction(
        senderAta,
        platformAta,
        sender,
        BigInt(LISTING_FEE_ECHOES) * BigInt(10) ** BigInt(ECHOES_DECIMALS),
        [],
        tokenProgramId
      )
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const tx = new Transaction({ feePayer: sender, blockhash, lastValidBlockHeight }).add(...instructions);

    return NextResponse.json({
      transactions: [tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64")],
      feeEchoes: LISTING_FEE_ECHOES,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error("[listing tx]", error);
    return NextResponse.json({ error: "Could not build the listing payment" }, { status: 500 });
  }
}
