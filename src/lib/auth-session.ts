import { SignJWT } from "jose";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_AUDIENCE,
  AUTH_ISSUER,
  CHALLENGE_COOKIE,
  SESSION_COOKIE,
  authSecret,
  shouldSecureAuthCookies,
} from "@/lib/auth-server";
import { dbCreateAppSession, dbSupportsAppSessions } from "@/lib/db-server";

/** What the Android app says about the device it signs in from. */
export interface DeviceInfo {
  name: string;
  platform: string;
  seeker: boolean;
}

/** Accepts only short printable strings; anything else is dropped, not trusted. */
export function parseDeviceInfo(value: unknown): DeviceInfo | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const clean = (x: unknown, max: number) =>
    typeof x === "string" ? x.replace(/[^\p{L}\p{N} ._()\-+,/]/gu, "").trim().slice(0, max) : "";
  const name = clean(v.name, 80);
  const platform = clean(v.platform, 40);
  if (!name) return null;
  return { name, platform: platform || "Android", seeker: v.seeker === true };
}

/**
 * Issues the session cookie for a verified wallet. A sign-in from the app with
 * device details is recorded as a device session so the owner can see it and
 * sign it out later; the session id travels inside the signed cookie.
 */
export async function issueSession(
  req: NextRequest,
  address: string,
  device: DeviceInfo | null,
): Promise<NextResponse> {
  let sid: string | undefined;
  if (device && (await dbSupportsAppSessions())) {
    sid = randomUUID();
    try {
      await dbCreateAppSession({
        id: sid,
        wallet: address,
        deviceName: device.name,
        platform: device.platform,
        isSeeker: device.seeker,
      });
    } catch (error) {
      // Signing in matters more than the device list: fall back to an untracked session.
      console.warn("[auth] device session not recorded:", error);
      sid = undefined;
    }
  }

  const claims: Record<string, unknown> = { purpose: "session" };
  if (sid) claims.sid = sid;
  const session = await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(AUTH_ISSUER)
    .setAudience(AUTH_AUDIENCE)
    .setSubject(address)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(authSecret());

  const response = NextResponse.json({ authenticated: true, address, sessionId: sid ?? null });
  response.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: shouldSecureAuthCookies(req),
    sameSite: "strict",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  response.cookies.set(CHALLENGE_COOKIE, "", {
    httpOnly: true,
    secure: shouldSecureAuthCookies(req),
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 0,
  });
  return response;
}

/** The public origin the request came through, honouring the reverse proxy. */
export function publicOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const protocol = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return host ? `${protocol}://${host.split(",")[0].trim()}` : req.nextUrl.origin;
}

/**
 * Fields of a Sign In With Solana message (the CAIP-122 / EIP-4361 text a wallet
 * builds from the payload and signs). Only what the server checks is extracted.
 */
export interface SiwsFields {
  domain: string;
  address: string;
  nonce: string | null;
  chainId: string | null;
  issuedAt: string | null;
  expirationTime: string | null;
}

export function parseSiwsMessage(text: string): SiwsFields | null {
  const lines = text.split("\n");
  const header = /^(.+) wants you to sign in with your Solana account:$/.exec(lines[0] ?? "");
  const address = (lines[1] ?? "").trim();
  if (!header || !address) return null;
  const field = (key: string) => {
    const line = lines.find((l) => l.startsWith(`${key}: `));
    return line ? line.slice(key.length + 2).trim() : null;
  };
  return {
    domain: header[1].trim(),
    address,
    nonce: field("Nonce"),
    chainId: field("Chain ID"),
    issuedAt: field("Issued At"),
    expirationTime: field("Expiration Time"),
  };
}
