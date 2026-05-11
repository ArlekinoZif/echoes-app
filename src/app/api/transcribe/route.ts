import { NextRequest, NextResponse } from "next/server";

const QVAC_URL = process.env.QVAC_SERVER_URL ?? "http://localhost:11434";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;
    if (!audio) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Forward to QVAC OpenAI-compatible transcription endpoint
    const upstream = new FormData();
    upstream.append("file", audio, audio.name || "recording.webm");
    upstream.append("model", process.env.QVAC_WHISPER_MODEL ?? "whisper-1");
    upstream.append("language", "en");

    const res = await fetch(`${QVAC_URL}/v1/audio/transcriptions`, {
      method: "POST",
      body: upstream,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[QVAC] Transcription upstream error:", res.status, detail);
      return NextResponse.json(
        { error: "QVAC transcription failed", detail },
        { status: 502 }
      );
    }

    const { text } = await res.json();
    return NextResponse.json({ transcript: (text ?? "").trim() });
  } catch (err) {
    const msg = String(err);
    // Surface a helpful message when the QVAC server isn't running
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      return NextResponse.json(
        {
          error: "QVAC server not running",
          detail: `Start it with: npx @qvac/cli serve openai  (binds to ${QVAC_URL})`,
        },
        { status: 503 }
      );
    }
    console.error("[QVAC] Transcription error:", err);
    return NextResponse.json({ error: "Transcription failed", detail: msg }, { status: 500 });
  }
}
