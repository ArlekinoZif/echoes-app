"use client";

import { authenticatedFetch } from "./authenticated-fetch";

export interface UploadResult {
  url: string;
  key: string;
}

async function uploadToR2(file: Blob | File, filename: string, contentType: string): Promise<UploadResult> {
  const res = await authenticatedFetch("/api/upload", {
    method: "POST",
    headers: {
      "x-filename": filename,
      "x-content-type": contentType,
    },
    body: file,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? "Upload failed");
  }

  return res.json() as Promise<UploadResult>;
}

export async function uploadImageToR2(file: File): Promise<UploadResult> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `cover-${Date.now()}.${ext}`;
  return uploadToR2(file, filename, file.type || "image/jpeg");
}

export async function uploadAudioToR2(blob: Blob): Promise<UploadResult> {
  const filename = `recording-${Date.now()}.webm`;
  return uploadToR2(blob, filename, blob.type || "audio/webm");
}
