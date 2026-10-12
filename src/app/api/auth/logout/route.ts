import { NextRequest, NextResponse } from "next/server";
import {
  CHALLENGE_COOKIE,
  SESSION_COOKIE,
  authErrorResponse,
  requireSession,
  requireSameOrigin,
  shouldSecureAuthCookies,
} from "@/lib/auth-server";
import { dbRevokeAppSession } from "@/lib/db-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    // Signing out of the app also removes this device from the owner's list.
    try {
      const { address, sessionId } = await requireSession(req);
      if (sessionId) await dbRevokeAppSession(address, sessionId);
    } catch {
      // Already signed out or no device record: clearing the cookie is enough.
    }
    const response = NextResponse.json({ ok: true });
    for (const [name, path] of [[SESSION_COOKIE, "/"], [CHALLENGE_COOKIE, "/api/auth"]] as const) {
      response.cookies.set(name, "", {
        httpOnly: true,
        secure: shouldSecureAuthCookies(req),
        sameSite: "strict",
        path,
        maxAge: 0,
      });
    }
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
