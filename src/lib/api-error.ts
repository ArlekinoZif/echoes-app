import { NextResponse } from "next/server";

/**
 * A 5xx response that says something went wrong without saying what: the
 * exception (which can carry database or provider details) goes to the server
 * log only.
 */
export function internalError(err: unknown, where: string, status = 500): NextResponse {
  console.error(`[${where}]`, err);
  return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status });
}
