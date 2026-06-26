// Short broadcast chirp (cliply's clip-clipit), bundled as a Vite asset so the
// Tauri webview can reach it offline. One reused element so rapid plays don't
// stack instances.
import clipSfx from "../assets/clip-clipit.mp3";

let el: HTMLAudioElement | null = null;

export function playSfx(volume = 0.5) {
  if (typeof window === "undefined") return;
  try {
    if (!el) {
      el = new Audio(clipSfx);
    }
    el.volume = volume;
    el.currentTime = 0;
    void el.play().catch(() => {
      /* autoplay-blocked / unsupported — ignore */
    });
  } catch {
    /* ignore */
  }
}
