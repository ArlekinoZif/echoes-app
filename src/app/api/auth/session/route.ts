import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const address = await requireUser(req);
    return NextResponse.json({ authenticated: true, address });
  } catch {
    return NextResponse.json({ authenticated: false, address: null });
  }
}
