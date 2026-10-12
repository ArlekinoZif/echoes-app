import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { dbFetchProfile, dbUpsertProfile } from "@/lib/db-server";
import { AuthenticationError, assertOwnIdentity, authErrorResponse, requireUser } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await dbFetchProfile(await requireUser(req)));
  } catch (err) {
    if (err instanceof AuthenticationError) return authErrorResponse(err);
    return internalError(err, "profile");
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser(req);
    const profile = await req.json();
    assertOwnIdentity(userId, profile.wallet);
    await dbUpsertProfile(profile);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthenticationError) return authErrorResponse(err);
    return internalError(err, "profile");
  }
}
