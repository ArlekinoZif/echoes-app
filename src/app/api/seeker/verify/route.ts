import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireSameOrigin, requireUser } from "@/lib/auth-server";
import { dbSaveSeekerVerification, dbSeekerVerified, dbSupportsSeekerVerification } from "@/lib/db-server";
import { findSeekerGenesisToken } from "@/lib/seeker-genesis";

export const runtime = "nodejs";

/** Whether the signed-in wallet is a verified Seeker owner. */
export async function GET(req: NextRequest) {
  try {
    const address = await requireUser(req);
    if (!(await dbSupportsSeekerVerification())) return NextResponse.json({ available: false, verified: false });
    return NextResponse.json({ available: true, verified: await dbSeekerVerified(address) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

/**
 * Checks the signed-in wallet for a Seeker Genesis Token on-chain. The session
 * already proves control of the wallet (Sign In With Solana), which with the
 * token check is Solana Mobile's recommended way to verify a Seeker owner.
 */
export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const address = await requireUser(req);
    if (!(await dbSupportsSeekerVerification())) {
      return NextResponse.json({ error: "Seeker verification is not available yet." }, { status: 503 });
    }
    const mint = await findSeekerGenesisToken(address);
    if (!mint) {
      return NextResponse.json({
        verified: false,
        reason: "No Seeker Genesis Token in this wallet. Sign in with the Seed Vault Wallet on your Seeker.",
      });
    }
    const saved = await dbSaveSeekerVerification(address, mint);
    if (!saved) {
      return NextResponse.json({ verified: false, reason: "This Seeker is already verified on another account." });
    }
    return NextResponse.json({ verified: true });
  } catch (error) {
    if (error instanceof Error && /RPC|fetch|timeout|aborted/i.test(error.message)) {
      return NextResponse.json({ error: "Could not reach Solana right now. Try again shortly." }, { status: 502 });
    }
    return authErrorResponse(error);
  }
}
