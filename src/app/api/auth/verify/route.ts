import { jwtVerify } from "jose";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { NextRequest } from "next/server";
import {
  AUTH_AUDIENCE,
  AUTH_ISSUER,
  CHALLENGE_COOKIE,
  AuthenticationError,
  authErrorResponse,
  authSecret,
  requireSameOrigin,
} from "@/lib/auth-server";
import { issueSession, parseDeviceInfo, parseSiwsMessage } from "@/lib/auth-session";

export const runtime = "nodejs";

function verifySignature(message: Uint8Array, signatureB64: unknown, address: string) {
  if (typeof signatureB64 !== "string") throw new AuthenticationError("Invalid wallet signature");
  const signature = Buffer.from(signatureB64, "base64");
  let publicKey: Uint8Array;
  try {
    publicKey = bs58.decode(address);
  } catch {
    throw new AuthenticationError("Invalid wallet address");
  }
  if (signature.length !== nacl.sign.signatureLength || publicKey.length !== nacl.sign.publicKeyLength) {
    throw new AuthenticationError("Invalid wallet signature");
  }
  if (!nacl.sign.detached.verify(message, signature, publicKey)) {
    throw new AuthenticationError("Wallet signature verification failed");
  }
}

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const challengeToken = req.cookies.get(CHALLENGE_COOKIE)?.value;
    if (!challengeToken) throw new AuthenticationError("Authentication challenge expired");
    const { payload } = await jwtVerify(challengeToken, authSecret(), {
      algorithms: ["HS256"],
      issuer: AUTH_ISSUER,
      audience: AUTH_AUDIENCE,
    });
    const body = await req.json();
    const device = parseDeviceInfo(body.device);

    // Sign In With Solana: the wallet signed the standard message it built from
    // our payload. Check it is ours (domain, nonce), for this wallet, and live.
    if (payload.purpose === "challenge-siws") {
      if (typeof body.address !== "string" || typeof body.signedMessage !== "string") {
        throw new AuthenticationError("Invalid sign-in result");
      }
      const messageBytes = Buffer.from(body.signedMessage, "base64");
      const fields = parseSiwsMessage(messageBytes.toString("utf8"));
      if (!fields) throw new AuthenticationError("Unrecognised sign-in message");
      if (fields.domain !== payload.domain) throw new AuthenticationError("Sign-in message is for another site");
      if (fields.address !== body.address) throw new AuthenticationError("Wallet identity mismatch");
      if (!payload.nonce || fields.nonce !== payload.nonce) throw new AuthenticationError("Sign-in message is stale");
      if (fields.chainId && !/mainnet/.test(fields.chainId)) throw new AuthenticationError("Sign in on Solana mainnet");
      if (fields.expirationTime && Date.parse(fields.expirationTime) < Date.now()) {
        throw new AuthenticationError("Sign-in message expired");
      }
      verifySignature(messageBytes, body.signature, body.address);
      return await issueSession(req, body.address, device);
    }

    // The original flow: the server wrote the message, the wallet signed it.
    if (payload.purpose !== "challenge" || typeof payload.address !== "string" || typeof payload.message !== "string") {
      throw new AuthenticationError("Invalid authentication challenge");
    }
    if (body.address !== payload.address) throw new AuthenticationError("Wallet identity mismatch");
    verifySignature(new TextEncoder().encode(payload.message), body.signature, payload.address);
    return await issueSession(req, payload.address, device);
  } catch (error) {
    return authErrorResponse(error);
  }
}
