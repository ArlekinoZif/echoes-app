import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { dbFetchFavourites, dbToggleFavourite } from "@/lib/db-server";
import { AuthenticationError, assertOwnIdentity, authErrorResponse, requireUser } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await dbFetchFavourites(await requireUser(req)));
  } catch (err) {
    if (err instanceof AuthenticationError) return authErrorResponse(err);
    console.error("[favourites GET]", err);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser(req);
    const { storyId, wallet } = await req.json();
    assertOwnIdentity(userId, wallet);
    const isFav = await dbToggleFavourite(storyId, userId);
    return NextResponse.json({ isFav });
  } catch (err) {
    if (err instanceof AuthenticationError) return authErrorResponse(err);
    return internalError(err, "favourites");
  }
}
