"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import {
  clearMediaSession,
  onMediaCommand,
  publishMediaSession,
} from "@/lib/native-bridge";

const bus = {
  listeners: new Set<() => void>(),
  emit(except: () => void) { bus.listeners.forEach(fn => fn !== except && fn()); },
};

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

interface AudioPlayerProps {
  src: string;
  durationSeconds?: number;
  /** Shown on the Seeker lock screen and in the playback notification. */
  title?: string;
  artist?: string;
  artwork?: string;
}

export default function AudioPlayer({
  src,
  durationSeconds = 0,
  title,
  artist,
  artwork,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);
  const ownsSession = useRef(false);
  const lastPublished = useRef(0);

  const stop = useCallback(() => { audioRef.current?.pause(); }, []);
  useEffect(() => { bus.listeners.add(stop); return () => { bus.listeners.delete(stop); }; }, [stop]);

  // Mirror playback into the native media session so a story keeps playing with
  // lock-screen controls while the Seeker shell is in the background.
  const syncSession = useCallback(
    (isPlaying: boolean) => {
      const a = audioRef.current;
      if (!a) return;
      ownsSession.current = true;
      lastPublished.current = Date.now();
      publishMediaSession({
        title: title ?? "Echoes story",
        artist,
        artwork,
        playing: isPlaying,
        position: a.currentTime,
        duration: Number.isFinite(a.duration) ? a.duration : duration,
      });
    },
    [artist, artwork, duration, title]
  );

  const releaseSession = useCallback(() => {
    if (!ownsSession.current) return;
    ownsSession.current = false;
    clearMediaSession();
  }, []);

  useEffect(() => () => { releaseSession(); }, [releaseSession]);

  useEffect(
    () =>
      onMediaCommand((command, value) => {
        const a = audioRef.current;
        if (!a || !ownsSession.current) return;
        switch (command) {
          case "play":
            bus.emit(stop);
            a.play().catch(() => {});
            break;
          case "pause":
            a.pause();
            break;
          case "stop":
            a.pause();
            a.currentTime = 0;
            ownsSession.current = false;
            break;
          case "seek":
            a.currentTime = Math.max(0, value / 1000);
            break;
        }
      }),
    [stop]
  );

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { bus.emit(stop); a.play().catch(() => {}); }
  }

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    const a = audioRef.current;
    if (!a) return;
    const t = Number(e.target.value);
    a.currentTime = t;
    setCurrentTime(t);
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <audio ref={audioRef} src={src} preload="none"
        onPlay={() => { setPlaying(true); syncSession(true); }}
        onPause={() => { setPlaying(false); syncSession(false); }}
        onEnded={() => { setPlaying(false); setCurrentTime(0); releaseSession(); }}
        onTimeUpdate={() => {
          setCurrentTime(audioRef.current?.currentTime ?? 0);
          // Keep the notification's scrubber roughly in step without spamming the bridge.
          if (playing && Date.now() - lastPublished.current > 2000) syncSession(true);
        }}
        onLoadedMetadata={() => {
          const d = audioRef.current?.duration;
          if (d && isFinite(d)) setDuration(d);
          if (playing) syncSession(true);
        }}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onError={() => setLoading(false)} />

      <button onClick={toggle}
        className="btn-gold w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-90">
        {loading ? <Loader2 className="w-3 h-3 animate-spin" style={{ color: "#0c0c0c" }} />
          : playing ? <Pause className="w-3 h-3" style={{ color: "#0c0c0c" }} />
          : <Play className="w-3 h-3" style={{ color: "#0c0c0c", marginLeft: "1px" }} />}
      </button>

      <div className="relative flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${progress}%`, background: "rgba(255,255,255,0.6)" }} />
        <input type="range" min="0" max={duration || 1} step="0.1" value={currentTime}
          onChange={handleScrub}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" style={{ margin: 0 }} />
      </div>

      <span className="text-xs font-mono flex-shrink-0 tabular-nums" style={{ color: "var(--text-3)", minWidth: "2.8rem", textAlign: "right" }}>
        {playing || currentTime > 0 ? fmt(currentTime) : fmt(duration)}
      </span>
    </div>
  );
}
