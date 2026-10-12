/**
 * Content reports. The dApp Store publisher policy requires a reporting path for
 * user-generated content, and every story on Echoes is user-generated.
 *
 * POST /api/reports  { storyId, reason, details? }
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { dbFetchStory, dbInsertReport, dbSupportsReports } from "@/lib/db-server";
import { authErrorResponse, requireUser } from "@/lib/auth-server";

const REASONS = [
  "sexual_content",
  "violence_or_hate",
  "illegal_activity",
  "harassment",
  "impersonation",
  "spam_or_scam",
  "other",
] as const;

export async function POST(req: NextRequest) {
  let userId: string;
  try { userId = await requireUser(req); } catch (error) { return authErrorResponse(error); }

  if (!(await dbSupportsReports())) {
    return NextResponse.json(
      { error: "Reporting is temporarily unavailable. Please email privacy@echoes.fans." },
      { status: 503 }
    );
  }

  const { storyId, reason, details } = await req.json();
  if (!storyId || !reason) {
    return NextResponse.json({ error: "storyId and reason are required" }, { status: 400 });
  }
  if (!REASONS.includes(reason)) {
    return NextResponse.json({ error: "Unknown reason" }, { status: 400 });
  }
  if (typeof details === "string" && details.length > 1000) {
    return NextResponse.json({ error: "Details must be 1000 characters or fewer" }, { status: 400 });
  }

  const story = await dbFetchStory(storyId);
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  try {
    await dbInsertReport({
      id: randomUUID(),
      storyId,
      reporterId: userId,
      reason,
      details: typeof details === "string" ? details.trim() : undefined,
    });
  } catch (error) {
    console.error("[reports POST]", error);
    return NextResponse.json({ error: "Could not record the report" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export function GET() {
  return NextResponse.json({ reasons: REASONS });
}
