/**
 * The caller's own referral code and how many people used it.
 *
 * GET /api/referral?wallet=<address>
 * Returns: { code, count, referredBy, referralSplit }
 *
 * A code is generated on first read, so a profile that has never been saved
 * still gets one.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbCountReferrals, dbFetchProfile, dbUpsertProfile } from "@/lib/db-server";
import { assertOwnIdentity, authErrorResponse, requireUser } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  let userId: string;
  try { userId = await requireUser(req); } catch (error) { return authErrorResponse(error); }

  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet required" }, { status: 400 });
  }
  // A referral code is tied to earnings, so only its owner may read it.
  try { assertOwnIdentity(userId, wallet); } catch (error) { return authErrorResponse(error); }

  try {
    let profile = await dbFetchProfile(wallet);
    if (!profile?.referralCode) {
      await dbUpsertProfile({ wallet, ...(profile ?? {}) });
      profile = await dbFetchProfile(wallet);
    }
    const code = profile?.referralCode ?? null;
    const count = code ? await dbCountReferrals(code) : 0;
    return NextResponse.json({
      code,
      count,
      referredBy: profile?.referredBy ?? null,
      referralSplit: profile?.referralSplit ?? 0.5,
    });
  } catch (error) {
    console.error("[referral GET]", error);
    return NextResponse.json({ code: null, count: 0, referredBy: null, referralSplit: 0.5 });
  }
}
