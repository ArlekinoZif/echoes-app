import { NextRequest, NextResponse } from "next/server";

const QVAC_URL = process.env.QVAC_SERVER_URL ?? "http://localhost:11434";

// Maps our friendly voice labels to OpenAI-compatible voice IDs
const VOICE_MAP: Record<string, string> = {
  M1: "onyx",
  M2: "echo",
  F1: "nova",
  F2: "shimmer",
  F3: "alloy",
};

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { text, voice = "M1" } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const res = await fetch(`${QVAC_URL}/v1/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.QVAC_TTS_MODEL ?? "tts-1",
        input: text.trim(),
        voice: VOICE_MAP[voice] ?? "onyx",
        response_format: "wav",
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[QVAC] TTS upstream error:", res.status, detail);
      return NextResponse.json(
        { error: "QVAC TTS failed", detail },
        { status: 502 }
      );
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "audio/wav",
        "Content-Length": String(audioBuffer.byteLength),
      },
    });
  } catch (err) {
    const msg = String(err);
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      return NextResponse.json(
        {
          error: "QVAC server not running",
          detail: `Start it with: npx @qvac/cli serve openai  (binds to ${QVAC_URL})`,
        },
        { status: 503 }
      );
    }
    console.error("[QVAC] TTS error:", err);
    return NextResponse.json({ error: "TTS failed", detail: msg }, { status: 500 });
  }
}
