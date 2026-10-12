/**
 * Optional voice enhancement via ElevenLabs Audio Isolation.
 * Strips background noise / room tone from a recording, returning clean speech.
 *
 * POST /api/enhance-voice
 *   Body: raw audio bytes
 *   Header x-content-type: original mime (e.g. audio/webm)
 *   Returns: enhanced audio bytes (audio/mpeg), or JSON { error } on failure.
 *
 * Docs: https://elevenlabs.io/docs/api-reference/audio-isolation
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { authErrorResponse, requireUser } from "@/lib/auth-server";

export const maxDuration = 60;

const ELEVENLABS_URL = "https://api.elevenlabs.io/v1/audio-isolation";

export async function POST(req: NextRequest) {
  try { await requireUser(req); } catch (error) { return authErrorResponse(error); }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ElevenLabs is not configured" }, { status: 503 });
  }

  try {
    const inputBytes = await req.arrayBuffer();
    if (inputBytes.byteLength === 0) {
      return NextResponse.json({ error: "Empty audio" }, { status: 400 });
    }

    const contentType = req.headers.get("x-content-type") ?? "audio/webm";
    const ext = contentType.includes("mp3") || contentType.includes("mpeg") ? "mp3" : "webm";

    const form = new FormData();
    form.append("audio", new Blob([inputBytes], { type: contentType }), `recording.${ext}`);

    const res = await fetchWithTimeout(
      ELEVENLABS_URL,
      { method: "POST", headers: { "xi-api-key": apiKey }, body: form },
      55_000
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("ElevenLabs audio-isolation error:", res.status, text);
      return NextResponse.json({ error: `ElevenLabs ${res.status}: ${text}` }, { status: 502 });
    }

    const enhanced = await res.arrayBuffer();
    return new NextResponse(enhanced, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("enhance-voice error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
