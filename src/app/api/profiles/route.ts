/**
 * Public profile subset for a batch of wallets, used to describe who recorded or
 * evaluated a story. Only the fields the product displays publicly are returned;
 * email, twitter, goals and referral data never leave this route.
 *
 * GET /api/profiles?wallets=a,b,c
 */
import { NextRequest, NextResponse } from "next/server";
import { dbFetchProfiles } from "@/lib/db-server";

const MAX_WALLETS = 100;

export async function GET(req: NextRequest) {
  const wallets = (new URL(req.url).searchParams.get("wallets") ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, MAX_WALLETS);

  if (!wallets.length) return NextResponse.json([]);

  try {
    const profiles = await dbFetchProfiles(wallets);
    return NextResponse.json(
      profiles.map((p) => ({
        wallet: p.wallet,
        age: p.age ?? null,
        country: p.country ?? null,
        languages: p.languages ?? null,
      }))
    );
  } catch (error) {
    console.error("[profiles GET]", error);
    return NextResponse.json({ error: "Profile lookup failed" }, { status: 500 });
  }
}
