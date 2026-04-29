"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, Square, Play, Pause, Trash2 } from "lucide-react";
import clsx from "clsx";

interface Props {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void;
}

type RecorderState = "idle" | "recording" | "recorded";

export default function AudioRecorder({ onRecordingComplete }: Props) {
  const [state, setState] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);

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
        const pct =
          (audioRef.current.currentTime / audioRef.current.duration) * 100;
        setPlayProgress(pct);
      };
      audioRef.current.onended = () => setIsPlaying(false);
      stream.getTracks().forEach((t) => t.stop());
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
  }, []);

  const confirm = useCallback(() => {
    if (blobRef.current) onRecordingComplete(blobRef.current, duration);
  }, [duration, onRecordingComplete]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center gap-6 p-8 rounded-2xl bg-neutral-900 border border-neutral-800">
      {/* Waveform / status visual */}
      <div className="flex items-center gap-1 h-12">
        {state === "recording" ? (
          Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-red-500 rounded-full animate-pulse"
              style={{
                height: `${20 + Math.random() * 28}px`,
                animationDelay: `${i * 50}ms`,
              }}
            />
          ))
        ) : state === "recorded" ? (
          <div className="w-48 h-2 bg-neutral-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${playProgress}%` }}
            />
          </div>
        ) : (
          <Mic className="w-10 h-10 text-neutral-600" />
        )}
      </div>

      {/* Timer */}
      <span
        className={clsx(
          "text-3xl font-mono font-bold",
          state === "recording" ? "text-red-400" : "text-neutral-400"
        )}
      >
        {fmt(duration)}
      </span>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {state === "idle" && (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full font-semibold transition-colors"
          >
            <Mic className="w-4 h-4" />
            Start Recording
          </button>
        )}

        {state === "recording" && (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-6 py-3 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-semibold transition-colors"
          >
            <Square className="w-4 h-4 fill-white" />
            Stop
          </button>
        )}

        {state === "recorded" && (
          <>
            <button
              onClick={discard}
              className="p-3 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 transition-colors"
              title="Discard"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={togglePlay}
              className="p-3 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={confirm}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-full font-semibold transition-colors"
            >
              Use this recording
            </button>
          </>
        )}
      </div>

      {state === "idle" && (
        <p className="text-xs text-neutral-600 text-center">
          Your microphone will be used to record your story.
        </p>
      )}
    </div>
  );
}
