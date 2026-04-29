"use client";

export interface UploadResult {
  url: string;
  key: string;
}

export async function uploadAudioToR2(blob: Blob): Promise<UploadResult> {
  const filename = `recording-${Date.now()}.webm`;

  // Get presigned URL from our API
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, contentType: blob.type || "audio/webm" }),
  });

  if (!res.ok) throw new Error("Failed to get upload URL");

  const { presignedUrl, key } = await res.json();

  // Upload directly to R2
  const uploadRes = await fetch(presignedUrl, {
    method: "PUT",
    headers: { "Content-Type": blob.type || "audio/webm" },
    body: blob,
  });

  if (!uploadRes.ok) throw new Error("Upload to R2 failed");

  // Public URL via R2 public bucket domain
  const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";
  const url = publicBase ? `${publicBase}/${key}` : URL.createObjectURL(blob);

  return { url, key };
}
