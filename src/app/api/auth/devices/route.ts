import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireSession } from "@/lib/auth-server";
import { dbListAppSessions, dbSupportsAppSessions } from "@/lib/db-server";

export const runtime = "nodejs";

/** The app devices signed in to the caller's account, newest activity first. */
export async function GET(req: NextRequest) {
  try {
    const { address, sessionId } = await requireSession(req);
    if (!(await dbSupportsAppSessions())) {
      return NextResponse.json({ available: false, devices: [] });
    }
    const devices = await dbListAppSessions(address);
    return NextResponse.json({
      available: true,
      devices: devices.map((d) => ({
        id: d.id,
        name: d.deviceName ?? "Android device",
        platform: d.platform,
        seeker: d.isSeeker,
        createdAt: d.createdAt,
        lastSeenAt: d.lastSeenAt,
        current: d.id === sessionId,
      })),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
