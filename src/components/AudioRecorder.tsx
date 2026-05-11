"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, Square, Play, Pause, Trash2, Loader2 } from "lucide-react";
import clsx from "clsx";

interface Props {
  onRecordingComplete: (blob: Blob, durationSeconds: number, transcript?: string) => void;
}

type RecorderState = "idle" | "recording" | "recorded";

export default function AudioRecorder({ onRecordingComplete }: Props) {
  const [state, setState] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | undefined>(undefined);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  const startTranscription = useCallback(async (blob: Blob) => {
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      if (res.ok) {
        const { transcript: text } = await res.json();
        setTranscript(text ?? undefined);
      }
    } catch {
      // Non-fatal — transcript just won't be pre-filled
    } finally {
      setTranscribing(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      blobRef.current = blob;
      const url = URL.createObjectURL(blob);
      audioRef.current = new Audio(url);
      audioRef.current.ontimeupdate = () => {
        if (!audioRef.current) return;
        const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100;
        setPlayProgress(pct);
      };
      audioRef.current.onended = () => setIsPlaying(false);
      stream.getTracks().forEach((t) => t.stop());
      setState("recorded");
      // Kick off transcription in background
      startTranscription(blob);
    };

    recorder.start();
    startTimeRef.current = Date.now();
    setState("recording");

    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setDuration(secs);
      durationRef.current = secs;
    }, 1000);
  }, [startTranscription]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    durationRef.current = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setDuration(durationRef.current);
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const discard = useCallback(() => {
    audioRef.current?.pause();
    blobRef.current = null;
    audioRef.current = null;
    setState("idle");
    setDuration(0);
    setPlayProgress(0);
    setIsPlaying(false);
    setTranscript(undefined);
    setTranscribing(false);
  }, []);

  const confirm = useCallback(() => {
    if (blobRef.current) {
      onRecordingComplete(blobRef.current, durationRef.current, transcript);
    }
  }, [transcript, onRecordingComplete]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div
      className="flex flex-col items-center gap-6 p-8 rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.6)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.8)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
      }}
    >
      {/* Waveform / status visual */}
      <div className="flex items-center gap-1 h-12">
        {state === "recording" ? (
          Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="w-1 rounded-full animate-pulse"
              style={{
                height: `${20 + Math.random() * 28}px`,
                background: "linear-gradient(180deg, #ff6b9d, #c77dff)",
                animationDelay: `${i * 50}ms`,
              }}
            />
          ))
        ) : state === "recorded" ? (
          <div
            className="w-48 h-2 rounded-full overflow-hidden"
            style={{ background: "rgba(0,0,0,0.08)" }}
          >
            <div
              className="h-full transition-all"
              style={{ width: `${playProgress}%`, background: "var(--amber)" }}
            />
          </div>
        ) : (
          <Mic className="w-10 h-10" style={{ color: "var(--text-3)" }} />
        )}
      </div>

      {/* Timer */}
      <span
        className={clsx("text-3xl font-mono font-bold")}
        style={{ color: state === "recording" ? "#ff6b9d" : "var(--text-2)" }}
      >
        {fmt(duration)}
      </span>

      {/* Transcription status */}
      {state === "recorded" && (
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-3)" }}>
          {transcribing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Transcribing…
            </>
          ) : transcript ? (
            <span style={{ color: "#10b981" }}>✓ Transcript ready — will pre-fill description</span>
          ) : (
            <span>No transcript (description field will be blank)</span>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4">
        {state === "idle" && (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-colors"
            style={{ background: "linear-gradient(135deg, #ff6b9d, #c77dff)", color: "#fff" }}
          >
            <Mic className="w-4 h-4" />
            Start Recording
          </button>
        )}

        {state === "recording" && (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-colors"
            style={{
              background: "rgba(0,0,0,0.08)",
              color: "var(--text-1)",
              border: "1px solid rgba(0,0,0,0.1)",
            }}
          >
            <Square className="w-4 h-4" style={{ fill: "var(--text-1)" }} />
            Stop
          </button>
        )}

        {state === "recorded" && (
          <>
            <button
              onClick={discard}
              className="p-3 rounded-full transition-colors"
              style={{ background: "rgba(0,0,0,0.06)", color: "var(--text-3)" }}
              title="Discard"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={togglePlay}
              className="p-3 rounded-full transition-colors"
              style={{ background: "rgba(0,0,0,0.08)", color: "var(--text-1)" }}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button
              onClick={confirm}
              className="px-6 py-3 rounded-full font-semibold transition-colors"
              style={{
                background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)",
                color: "#fff",
              }}
            >
              Use this recording
            </button>
          </>
        )}
      </div>

      {state === "idle" && (
        <p className="text-xs text-center" style={{ color: "var(--text-3)" }}>
          Your microphone will be used to record your story.
        </p>
      )}
    </div>
  );
}
