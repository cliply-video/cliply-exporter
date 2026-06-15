import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { cancelDownload, downloadYoutube } from "../lib/api";
import { createVideo } from "../lib/db";

export function Home({ onVideo }: { onVideo: (videoId: string) => void }) {
  const { t } = useT();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const videoId = useRef<string | null>(null);

  useEffect(() => {
    const un = listen<{ videoId: string; percent: number }>(
      "media-download",
      (e) => {
        if (e.payload.videoId === videoId.current) setPercent(e.payload.percent);
      },
    );
    return () => {
      un.then((f) => f());
    };
  }, []);

  const start = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const id = crypto.randomUUID();
    videoId.current = id;
    setBusy(true);
    setError(null);
    setPercent(0);
    try {
      const out = await downloadYoutube(id, trimmed);
      if (out.status === "cancelled") {
        setBusy(false);
        return;
      }
      await createVideo({
        id,
        title: trimmed,
        url: trimmed,
        local_path: out.path ?? "",
      });
      onVideo(id);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }, [url, onVideo]);

  const cancel = useCallback(() => {
    if (videoId.current) cancelDownload(videoId.current);
  }, []);

  const steps = [1, 2, 3] as const;

  return (
    <div className="stage">
      <div className="hero">
        <div style={{ display: "grid", gap: 10 }}>
          <p className="eyebrow">{t("home.eyebrow")}</p>
          <h1 className="display">
            {t("home.titleA")}
            <br />
            <span className="gradient-text">{t("home.titleB")}</span>
          </h1>
        </div>

        <p className="lead">{t("home.lead")}</p>

        <div style={{ display: "grid", gap: 12 }}>
          <input
            className="input-xl"
            type="url"
            placeholder={t("home.placeholder")}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy}
          />
          {busy && (
            <div className="bar">
              <span style={{ width: `${percent}%` }} />
            </div>
          )}
          {error && <p style={{ color: "var(--destructive)", margin: 0 }}>{error}</p>}
          <div className="row">
            <button
              type="button"
              className="primary btn-lg"
              onClick={start}
              disabled={busy || !url.trim()}
            >
              {busy
                ? t("home.downloading", { pct: Math.round(percent) })
                : t("home.download")}
            </button>
            {busy && (
              <button type="button" className="btn-lg" onClick={cancel}>
                {t("home.cancel")}
              </button>
            )}
          </div>
        </div>

        <div className="steps">
          {steps.map((n) => (
            <div key={n} className="step">
              <div className="step-n">{`0${n}`}</div>
              <h3>{t(`home.step${n}.title`)}</h3>
              <p>{t(`home.step${n}.body`)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
