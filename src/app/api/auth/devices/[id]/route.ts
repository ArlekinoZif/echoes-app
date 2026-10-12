import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireSameOrigin, requireSession } from "@/lib/auth-server";
import { dbRevokeAppSession, dbSupportsAppSessions } from "@/lib/db-server";

export const runtime = "nodejs";

/** Signs one of the caller's own devices out. The device notices on its next request. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(req);
    const { address } = await requireSession(req);
    const { id } = await params;
    if (!(await dbSupportsAppSessions())) {
      return NextResponse.json({ error: "Device management is not available yet." }, { status: 503 });
    }
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Unknown device" }, { status: 404 });
    const removed = await dbRevokeAppSession(address, id);
    if (!removed) return NextResponse.json({ error: "Unknown device" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
