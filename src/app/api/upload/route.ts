import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";

export async function POST(req: NextRequest) {
  try {
    const { filename, contentType } = await req.json();
    if (!filename || !contentType) {
      return NextResponse.json({ error: "Missing filename or contentType" }, { status: 400 });
    }

    const key = `stories/${Date.now()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 300 });

    return NextResponse.json({ presignedUrl, key });
  } catch (err) {
    console.error("R2 presign error:", err);
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
