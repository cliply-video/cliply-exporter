import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { cancelDownload, downloadYoutube } from "../lib/api";
import { createVideo } from "../lib/db";

const STEPS = [
  { n: "01", title: "Paste a link", body: "Any YouTube URL — downloaded locally with yt-dlp." },
  { n: "02", title: "Import XML", body: "SportsCode / Nacsport tags become colored clips. Optional." },
  { n: "03", title: "Export", body: "MP4s in per-tag folders, plus reels. Stream-copy fast." },
];

export function Home({ onVideo }: { onVideo: (videoId: string) => void }) {
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

  return (
    <div className="stage">
      <div className="hero">
        <div style={{ display: "grid", gap: 10 }}>
          <p className="eyebrow">Open-source · offline clip cutter</p>
          <h1 className="display">
            Turn a match into
            <br />
            <span className="gradient-text">shareable clips.</span>
          </h1>
        </div>

        <p className="lead">
          Paste a video link, drop in your analysis XML, and export ready-to-cut
          MP4s — folders per tag and reels included. No account, no cloud,
          nothing leaves your machine.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <input
            className="input-xl"
            type="url"
            placeholder="https://www.youtube.com/watch?v=…"
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
              {busy ? `Downloading… ${Math.round(percent)}%` : "Download video →"}
            </button>
            {busy && (
              <button type="button" className="btn-lg" onClick={cancel}>
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="steps">
          {STEPS.map((s) => (
            <div key={s.n} className="step">
              <div className="step-n">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
