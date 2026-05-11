"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Loader2 } from "lucide-react";

// Global singleton: only one player active at a time
const bus = {
  listeners: new Set<() => void>(),
  emit(except: () => void) {
    bus.listeners.forEach((fn) => fn !== except && fn());
  },
};

interface Props {
  src: string;
  durationSeconds?: number;
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({ src, durationSeconds = 0 }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);

  // Register a stop callback so the bus can pause this instance
  const stop = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  useEffect(() => {
    bus.listeners.add(stop);
    return () => { bus.listeners.delete(stop); };
  }, [stop]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      bus.emit(stop); // pause all others
      audio.play().catch(() => {});
    }
  }

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Number(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
      style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.07)" }}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => {
          const d = audioRef.current?.duration;
          if (d && isFinite(d)) setDuration(d);
        }}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onError={() => setLoading(false)}
      />

      {/* Play / Pause button */}
      <button
        onClick={toggle}
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-90"
        style={{ background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)" }}
      >
        {loading ? (
          <Loader2 className="w-3 h-3 text-white animate-spin" />
        ) : playing ? (
          <Pause className="w-3 h-3 text-white" />
        ) : (
          <Play className="w-3 h-3 text-white" style={{ marginLeft: "1px" }} />
        )}
      </button>

      {/* Scrubber */}
      <div className="relative flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.1)" }}>
        {/* Filled track */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-none"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #00c6be, #ff6b9d)",
          }}
        />
        {/* Range input overlay */}
        <input
          type="range"
          min="0"
          max={duration || 1}
          step="0.1"
          value={currentTime}
          onChange={handleScrub}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          style={{ margin: 0 }}
        />
      </div>

      {/* Time */}
      <span
        className="text-xs font-mono flex-shrink-0 tabular-nums"
        style={{ color: "var(--text-3)", minWidth: "2.8rem", textAlign: "right" }}
      >
        {playing || currentTime > 0 ? fmt(currentTime) : fmt(duration)}
      </span>
    </div>
  );
}
