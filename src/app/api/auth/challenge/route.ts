import { SignJWT } from "jose";
import { randomBytes } from "crypto";
import { PublicKey } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_AUDIENCE,
  AUTH_ISSUER,
  CHALLENGE_COOKIE,
  authErrorResponse,
  authSecret,
  requireSameOrigin,
  shouldSecureAuthCookies,
} from "@/lib/auth-server";
import { publicOrigin } from "@/lib/auth-session";

export const runtime = "nodejs";


/**
 * Sign In With Solana: the wallet builds and signs the standard message from
 * these fields in a single prompt (Seed Vault, Phantom, Solflare). The server
 * keeps the nonce in a short-lived signed cookie and checks it in /verify.
 */
async function siwsChallenge(req: NextRequest) {
  const nonce = randomBytes(18).toString("base64url");
  const issuedAtDate = new Date();
  const origin = publicOrigin(req);
  const domain = new URL(origin).host;
  const siws = {
    domain,
    statement: "Sign in to Echoes. This is not a transaction and costs nothing.",
    uri: origin,
    version: "1",
    chainId: "mainnet",
    nonce,
    issuedAt: issuedAtDate.toISOString(),
    expirationTime: new Date(issuedAtDate.getTime() + 5 * 60_000).toISOString(),
  };
  const token = await new SignJWT({ purpose: "challenge-siws", nonce, domain })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(AUTH_ISSUER)
    .setAudience(AUTH_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(authSecret());
  const response = NextResponse.json({ siws });
  response.cookies.set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: shouldSecureAuthCookies(req),
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 5 * 60,
  });
  return response;
}

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const body = await req.json();
    if (body?.mode === "siws") return await siwsChallenge(req);
    const address = typeof body.address === "string" ? body.address : "";
    const canonicalAddress = new PublicKey(address).toBase58();
    if (canonicalAddress !== address) throw new Error("Invalid wallet address");

    const nonce = randomBytes(18).toString("base64url");
    const issuedAtDate = new Date();
    const issuedAt = issuedAtDate.toISOString();
    const expirationTime = new Date(issuedAtDate.getTime() + 5 * 60_000).toISOString();
    const origin = publicOrigin(req);
    const message = [
      "Echoes authentication",
      `URI: ${origin}`,
      `Wallet: ${address}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt}`,
      `Expiration Time: ${expirationTime}`,
    ].join("\n");

    const token = await new SignJWT({ purpose: "challenge", address, message })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(AUTH_ISSUER)
      .setAudience(AUTH_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(authSecret());

    const response = NextResponse.json({ message });
    response.cookies.set(CHALLENGE_COOKIE, token, {
      httpOnly: true,
      secure: shouldSecureAuthCookies(req),
      sameSite: "strict",
      path: "/api/auth",
      maxAge: 5 * 60,
    });
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
