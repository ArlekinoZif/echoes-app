import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { AuthenticationError, authErrorResponse, requireUser } from "@/lib/auth-server";
import { r2, R2_BUCKET } from "@/lib/r2";
import { runtimeEnv } from "@/lib/runtime-env";

export const maxDuration = 60;

/** Set once R2 refuses a write, so later uploads go straight to Supabase Storage. */
let r2WriteDenied = false;

function getSupabase() {
  const url = runtimeEnv("SUPABASE_URL") ?? runtimeEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase Storage is not configured");
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser(req);
    const filename = req.headers.get("x-filename");
    const fileContentType = req.headers.get("x-content-type") ?? "application/octet-stream";

    if (!filename) {
      return NextResponse.json({ error: "Missing x-filename header" }, { status: 400 });
    }

    const isAudio = ["audio/webm", "video/webm", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav"].includes(fileContentType);
    const isImage = ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(fileContentType);
    if (!isAudio && !isImage) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
    }
    const body = await req.arrayBuffer();
    const maxBytes = isAudio ? 30 * 1024 * 1024 : 8 * 1024 * 1024;
    if (body.byteLength === 0 || body.byteLength > maxBytes) {
      return NextResponse.json({ error: `File must be between 1 byte and ${maxBytes / 1024 / 1024} MB` }, { status: 413 });
    }
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
    const ownerKey = Buffer.from(userId).toString("base64url");
    const key = `stories/${ownerKey}/${Date.now()}-${safeName}`;

    if (isAudio) {
      // R2 first (served privately through /api/audio). Production's R2 key
      // cannot write, so fall back to what the website itself uses: the
      // Supabase "echoes-audio" bucket with a public URL.
      if (!r2WriteDenied) {
        try {
          await r2.send(new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
            Body: Buffer.from(body),
            ContentType: fileContentType,
            CacheControl: "private, no-store",
          }));
          return NextResponse.json({ url: `/api/audio/${key}`, key });
        } catch (error) {
          const code = (error as { Code?: string; name?: string })?.Code ?? (error as { name?: string })?.name;
          if (code === "AccessDenied") r2WriteDenied = true;
          console.warn(`[upload] R2 write failed (${code ?? "unknown"}); using Supabase Storage`);
        }
      }
      const sb = getSupabase();
      const { error } = await sb.storage
        .from("echoes-audio")
        .upload(key, Buffer.from(body), { contentType: fileContentType, upsert: false });
      if (error) {
        console.error("Supabase audio upload error:", error);
        return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
      }
      const { data: { publicUrl } } = sb.storage.from("echoes-audio").getPublicUrl(key);
      return NextResponse.json({ url: publicUrl, key });
    }

    const sb = getSupabase();

    const { error } = await sb.storage
      .from("echoes-images")
      .upload(key, Buffer.from(body), {
        contentType: fileContentType,
        upsert: true,
      });

    if (error) {
      console.error("Supabase Storage upload error:", error);
      return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
    }

    const { data: { publicUrl } } = sb.storage.from("echoes-images").getPublicUrl(key);

    return NextResponse.json({ url: publicUrl, key });
  } catch (err) {
    if (err instanceof AuthenticationError) return authErrorResponse(err);
    // Internal details stay in the server log, never in the response.
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
