import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { dbCheckUnlock, dbFetchStory } from "@/lib/db-server";
import { AuthenticationError, authErrorResponse, requireUser } from "@/lib/auth-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const buyerId = await requireUser(req);
    const story = await dbFetchStory(id);
    if (!story) return NextResponse.json({ error: "not found" }, { status: 404 });
    const safeStory = { ...story };
    if (safeStory.isPrivate && safeStory.ownerId !== buyerId && !(await dbCheckUnlock(id, buyerId))) {
      safeStory.audioBlobUrl = "";
    }
    return NextResponse.json(safeStory);
  } catch (err) {
    if (err instanceof AuthenticationError) {
      return authErrorResponse(err);
    }
    return internalError(err, "stories/id");
  }
}
