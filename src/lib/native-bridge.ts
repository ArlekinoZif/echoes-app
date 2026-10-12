// Bridge to the Seeker native shell (seeker/native-app). All of it degrades to
// no-ops in a plain browser, so components can call it unconditionally.

export interface MediaSessionState {
  title: string;
  artist?: string;
  artwork?: string;
  playing: boolean;
  position: number; // seconds
  duration: number; // seconds
}

interface NativeBridge {
  platform?: () => string;
  versionName?: () => string;
  share?: (payload: string) => void;
  updateMediaSession?: (payload: string) => void;
  endMediaSession?: () => void;
}

export type MediaCommand = "play" | "pause" | "stop" | "seek" | "next" | "previous";

export const MEDIA_COMMAND_EVENT = "echoes-media-command";

function bridge(): NativeBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { EchoesNative?: NativeBridge }).EchoesNative ?? null;
}

/** True inside the Echoes Seeker Android shell. */
export function isSeekerShell(): boolean {
  return typeof bridge()?.platform === "function";
}

export function nativeVersion(): string | null {
  try {
    return bridge()?.versionName?.() ?? null;
  } catch {
    return null;
  }
}

/** Native share sheet, falling back to Web Share and finally the clipboard. */
export async function shareLink(input: { title?: string; text?: string; url: string }): Promise<boolean> {
  const payload = { title: input.title ?? "Echoes", text: input.text ?? "", url: input.url };
  const native = bridge();
  if (typeof native?.share === "function") {
    try {
      native.share(JSON.stringify(payload));
      return true;
    } catch {
      /* fall through */
    }
  }
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      return true;
    } catch {
      return false;
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(input.url);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** Publishes playback state to the Android media session (lock screen controls). */
export function publishMediaSession(state: MediaSessionState): void {
  const native = bridge();
  if (typeof native?.updateMediaSession !== "function") return;
  try {
    native.updateMediaSession(
      JSON.stringify({
        title: state.title,
        artist: state.artist ?? "",
        artwork: state.artwork ?? "",
        playing: state.playing,
        position: Number.isFinite(state.position) ? state.position : 0,
        duration: Number.isFinite(state.duration) ? state.duration : 0,
      })
    );
  } catch {
    /* the shell is gone — playback continues in the WebView */
  }
}

export function clearMediaSession(): void {
  try {
    bridge()?.endMediaSession?.();
  } catch {
    /* no-op */
  }
}

/**
 * Subscribes to transport commands coming from the notification or lock screen.
 * Returns an unsubscribe function.
 */
export function onMediaCommand(
  handler: (command: MediaCommand, value: number) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const data = (event as MessageEvent).data;
    if (!data) return;
    let parsed: { command?: string; value?: number };
    try {
      parsed = typeof data === "string" ? JSON.parse(data) : data;
    } catch {
      return;
    }
    if (!parsed.command) return;
    handler(parsed.command as MediaCommand, Number(parsed.value ?? 0));
  };
  window.addEventListener(MEDIA_COMMAND_EVENT, listener);
  return () => window.removeEventListener(MEDIA_COMMAND_EVENT, listener);
}
