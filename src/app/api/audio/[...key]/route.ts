import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET } from "@/lib/r2";
import { AuthenticationError, authErrorResponse, requireUser } from "@/lib/auth-server";
import { dbCheckUnlock, dbFetchStoryByAudioUrl } from "@/lib/db-server";

export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const objectKey = key.join("/");

  try {
    const userId = await requireUser(req);
    const audioUrl = `/api/audio/${objectKey}`;
    const story = await dbFetchStoryByAudioUrl(audioUrl);
    if (story) {
      const canListen = !story.isPrivate || story.ownerId === userId || await dbCheckUnlock(story.id, userId);
      if (!canListen) return new NextResponse("Forbidden", { status: 403 });
    } else {
      // Permit the uploader between upload completion and story creation only.
      const parts = objectKey.split("/");
      let ownerId = "";
      try { ownerId = Buffer.from(parts[1] ?? "", "base64url").toString("utf8"); } catch { /* invalid key */ }
      if (parts[0] !== "stories" || ownerId !== userId) return new NextResponse("Not found", { status: 404 });
    }

    const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: objectKey });
    const obj = await r2.send(cmd);

    if (!obj.Body) {
      return new NextResponse("Not found", { status: 404 });
    }

    const contentType = obj.ContentType ?? "audio/webm";
    const contentLength = obj.ContentLength;

    // Support Range requests for audio seeking
    const rangeHeader = req.headers.get("range");

    if (rangeHeader && contentLength) {
      const [startStr, endStr] = rangeHeader.replace("bytes=", "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? Math.min(parseInt(endStr, 10), contentLength - 1) : contentLength - 1;
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= contentLength) {
        return new NextResponse("Invalid range", { status: 416, headers: { "Content-Range": `bytes */${contentLength}` } });
      }
      const chunkSize = end - start + 1;

      const rangeCmd = new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: objectKey,
        Range: `bytes=${start}-${end}`,
      });
      const rangeObj = await r2.send(rangeCmd);

      if (!rangeObj.Body) {
        return new NextResponse("Not found", { status: 404 });
      }

      const stream = rangeObj.Body as ReadableStream;
      return new NextResponse(stream, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${contentLength}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": story?.isPrivate ? "private, no-store" : "private, max-age=3600",
        },
      });
    }

    const stream = obj.Body as ReadableStream;
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": story?.isPrivate ? "private, no-store" : "private, max-age=3600",
    };
    if (contentLength) headers["Content-Length"] = String(contentLength);

    return new NextResponse(stream, { status: 200, headers });
  } catch (err) {
    if (err instanceof AuthenticationError) return authErrorResponse(err);
    console.error("[audio proxy]", err);
    return new NextResponse("Not found", { status: 404 });
  }
}
