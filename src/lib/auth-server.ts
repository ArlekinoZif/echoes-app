import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { dbAppSessionActive, dbSupportsAppSessions } from "@/lib/db-server";

export const SESSION_COOKIE = "echoes-session";
export const CHALLENGE_COOKIE = "echoes-auth-challenge";
export const AUTH_ISSUER = "https://app.echoes.fans";
export const AUTH_AUDIENCE = "echoes-web";

export class AuthenticationError extends Error {}

export function authSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new AuthenticationError("Authentication is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function requireUser(req: NextRequest): Promise<string> {
  return (await requireSession(req)).address;
}

/**
 * The authenticated wallet, plus the device session id when the session was
 * issued to the app. A device the owner has signed out from the Devices list is
 * rejected here, so revocation reaches every authenticated route.
 */
export async function requireSession(req: NextRequest): Promise<{ address: string; sessionId: string | null }> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) throw new AuthenticationError("Authentication required");

  let address: string;
  let sessionId: string | null;
  try {
    const { payload } = await jwtVerify(token, authSecret(), {
      algorithms: ["HS256"],
      issuer: AUTH_ISSUER,
      audience: AUTH_AUDIENCE,
    });
    if (typeof payload.sub !== "string" || payload.sub.length < 32 || payload.sub.length > 64) {
      throw new AuthenticationError("Invalid user identity");
    }
    address = payload.sub;
    sessionId = typeof payload.sid === "string" ? payload.sid : null;
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    throw new AuthenticationError("Invalid or expired session");
  }

  if (sessionId && (await dbSupportsAppSessions()) && !(await dbAppSessionActive(sessionId))) {
    throw new AuthenticationError("This device was signed out");
  }
  return { address, sessionId };
}

export function requireSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const forwardedHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const forwardedProto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const expected = forwardedHost ? `${forwardedProto}://${forwardedHost}` : req.nextUrl.origin;
  if (origin !== expected) throw new AuthenticationError("Cross-origin request rejected");
}

export function shouldSecureAuthCookies(req: NextRequest) {
  const forwardedHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const host = forwardedHost.split(",")[0].trim();
  return !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
}

export function authErrorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Authentication failed";
  return NextResponse.json({ error: message }, { status: 401 });
}

export function assertOwnIdentity(authenticatedUserId: string, suppliedUserId: unknown) {
  if (suppliedUserId !== authenticatedUserId) throw new AuthenticationError("Identity mismatch");
}
