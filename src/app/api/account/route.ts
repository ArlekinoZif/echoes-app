/**
 * Account and data erasure, required by the publisher policy.
 *
 * DELETE /api/account  { confirm: "DELETE" }
 *
 * Removes the profile, favourites, evaluations, reports and unlock records, and
 * deletes every story the account owns. A tokenised story cannot be withdrawn
 * from the chain, so its personal identifiers are stripped instead.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbDeleteAccount } from "@/lib/db-server";
import {
  CHALLENGE_COOKIE,
  SESSION_COOKIE,
  authErrorResponse,
  requireSameOrigin,
  requireUser,
  shouldSecureAuthCookies,
} from "@/lib/auth-server";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest) {
  let userId: string;
  try {
    requireSameOrigin(req);
    userId = await requireUser(req);
  } catch (error) { return authErrorResponse(error); }

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "DELETE") {
    return NextResponse.json({ error: 'Send {"confirm":"DELETE"} to erase this account' }, { status: 400 });
  }

  try {
    const result = await dbDeleteAccount(userId);
    const res = NextResponse.json({ ok: true, ...result });
    // The session belongs to an account that no longer exists.
    for (const [name, path] of [[SESSION_COOKIE, "/"], [CHALLENGE_COOKIE, "/api/auth"]] as const) {
      res.cookies.set(name, "", {
        httpOnly: true,
        secure: shouldSecureAuthCookies(req),
        sameSite: "strict",
        path,
        maxAge: 0,
      });
    }
    return res;
  } catch (error) {
    console.error("[account DELETE]", error);
    return NextResponse.json({ error: "Could not erase the account" }, { status: 500 });
  }
}
