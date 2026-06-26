import { useEffect } from "react";
import { useT } from "../i18n";
import { playSfx } from "../lib/sfx";

// Boot splash — cliply's BxSplash look (black field, scanlines, pink mark, Anton
// wordmark, boot sweep) plus an "Exporter" tag stamp like the marketing site.
// Plays the clip chirp on mount, then auto-dismisses.
export function Splash({ onDone }: { onDone: () => void }) {
  const { t } = useT();

  useEffect(() => {
    playSfx();
    const id = window.setTimeout(onDone, 2000);
    return () => window.clearTimeout(id);
  }, [onDone]);

  return (
    <button
      type="button"
      className="splash"
      aria-label={t("splash.label")}
      onClick={onDone}
    >
      <span aria-hidden="true" className="splash-lines" />
      <span className="splash-lockup">
        <span className="splash-icon" aria-hidden="true">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M73.3 26.7 A33 33 0 1 0 73.3 73.3"
              stroke="currentColor"
              strokeWidth="9"
              strokeLinecap="round"
              fill="none"
            />
            <path d="M44 33 L71 50 L44 67 Z" fill="currentColor" />
          </svg>
        </span>
        <span className="splash-word">cliply</span>
        <span className="splash-stamp">{t("splash.badge")}</span>
      </span>
      <span aria-hidden="true" className="splash-bar">
        <i className="bx-boot-bar" />
      </span>
      <span className="splash-label">{t("splash.label")}</span>
    </button>
  );
}
