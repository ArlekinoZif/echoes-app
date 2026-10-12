import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { dbUpsertEvaluation, dbFetchMyEvaluatedIds } from "@/lib/db-server";
import { AuthenticationError, assertOwnIdentity, authErrorResponse, requireUser } from "@/lib/auth-server";
import type { Evaluation } from "@/lib/types";

function isScore(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 1 && value <= 5;
}

function isEvaluation(value: unknown): value is Evaluation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Evaluation>;
  const criteria = candidate.criteria;
  return (
    typeof candidate.storyId === "string" &&
    candidate.storyId.length > 0 &&
    candidate.storyId.length <= 128 &&
    !!criteria &&
    isScore(criteria.audioQuality) &&
    isScore(criteria.storytelling) &&
    isScore(criteria.descriptionAccuracy) &&
    typeof candidate.listenedPercent === "number" &&
    Number.isFinite(candidate.listenedPercent) &&
    candidate.listenedPercent >= 0 &&
    candidate.listenedPercent <= 100
  );
}

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await dbFetchMyEvaluatedIds(await requireUser(req)));
  } catch (err) {
    if (err instanceof AuthenticationError) return authErrorResponse(err);
    console.error("[evaluations GET]", err);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser(req);
    const { evaluation, evaluatorWallet } = await req.json();
    assertOwnIdentity(userId, evaluatorWallet);
    if (!isEvaluation(evaluation)) {
      return NextResponse.json({ error: "Invalid evaluation" }, { status: 400 });
    }
    await dbUpsertEvaluation(evaluation, userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthenticationError) return authErrorResponse(err);
    return internalError(err, "evaluations");
  }
}
