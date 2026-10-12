"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, Square, Play, Pause, Trash2, CheckCircle } from "lucide-react";

interface Props { onRecordingComplete: (blob: Blob, durationSeconds: number) => void; }
type State = "idle" | "recording" | "recorded";

export default function AudioRecorder({ onRecordingComplete }: Props) {
  const [state, setState] = useState<State>("idle");
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [bars] = useState(() => Array.from({ length: 24 }, (_, i) => i));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      blobRef.current = blob;
      const url = URL.createObjectURL(blob);
      audioRef.current = new Audio(url);
      audioRef.current.ontimeupdate = () => {
        if (!audioRef.current) return;
        setPlayProgress((audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100);
      };
      audioRef.current.onended = () => setIsPlaying(false);
      stream.getTracks().forEach(t => t.stop());
      setState("recorded");
    };

    recorder.start();
    startTimeRef.current = Date.now();
    setState("recording");
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play(); setIsPlaying(true); }
  }, [isPlaying]);

  const discard = useCallback(() => {
    audioRef.current?.pause();
    blobRef.current = null; audioRef.current = null;
    setState("idle"); setDuration(0); setPlayProgress(0); setIsPlaying(false);
  }, []);

  const confirm = useCallback(() => {
    if (blobRef.current) onRecordingComplete(blobRef.current, duration);
  }, [duration, onRecordingComplete]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center gap-8 p-8 rounded-2xl"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>

      {/* Visual */}
      <div className="flex items-center justify-center gap-1 h-14">
        {state === "recording" ? (
          bars.map(i => (
            <div key={i} className="w-1 rounded-full"
              style={{
                height: `${16 + Math.sin(i * 0.8) * 12 + 8}px`,
                background: `rgba(255,255,255,0.6)`,
                animation: `pulse ${0.6 + (i % 5) * 0.1}s ease-in-out ${i * 30}ms infinite alternate`,
                opacity: 0.7 + (i % 3) * 0.1,
              }} />
          ))
        ) : state === "recorded" ? (
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${playProgress}%`, background: "rgba(255,255,255,0.5)" }} />
            </div>
          </div>
        ) : (
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Mic className="w-7 h-7" style={{ color: "var(--text-3)" }} />
          </div>
        )}
      </div>

      {/* Timer */}
      <span className="text-4xl font-mono font-bold tabular-nums"
        style={{ color: state === "recording" ? "#ededed" : "var(--text-2)", letterSpacing: "-0.02em" }}>
        {fmt(duration)}
      </span>

      {/* Status text */}
      {state === "recording" && (
        <p className="text-xs font-medium -mt-4" style={{ color: "rgba(255,255,255,0.4)" }}>
          ● Recording… speak clearly
        </p>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4">
        {state === "idle" && (
          <button onClick={startRecording}
            className="btn-gold flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm transition-all active:scale-95 pulse-record">
            <Mic className="w-4 h-4" /> Start Recording
          </button>
        )}

        {state === "recording" && (
          <button onClick={stopRecording}
            className="flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm transition-all active:scale-95"
            style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-1)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <Square className="w-4 h-4" style={{ fill: "var(--text-1)" }} /> Stop &amp; finish
          </button>
        )}

        {state === "recorded" && (
          <>
            <button onClick={discard}
              className="p-3 rounded-full transition-all active:scale-90"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-3)" }}>
              <Trash2 className="w-5 h-5" />
            </button>
            <button onClick={togglePlay}
              className="p-3 rounded-full transition-all active:scale-90"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-1)" }}>
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button onClick={confirm}
              className="btn-gold flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all active:scale-95">
              <CheckCircle className="w-4 h-4" /> Use this recording
            </button>
          </>
        )}
      </div>

      {state === "idle" && (
        <p className="text-xs text-center" style={{ color: "var(--text-3)" }}>
          Tap to start — your microphone will be used to record.
        </p>
      )}
    </div>
  );
}
