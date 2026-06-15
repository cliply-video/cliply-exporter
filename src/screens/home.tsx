import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { cancelDownload, downloadYoutube } from "../lib/api";
import { createVideo } from "../lib/db";

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
    <div className="center">
      <div className="card">
        <h1>Cliply OSS</h1>
        <p className="muted">Paste a YouTube URL to download the source video.</p>
        <input
          type="url"
          placeholder="https://www.youtube.com/watch?v=…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--text)",
            margin: "12px 0",
          }}
        />
        {busy && (
          <div className="bar" style={{ margin: "12px 0" }}>
            <span style={{ width: `${percent}%` }} />
          </div>
        )}
        {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}
        <div className="row">
          <button
            type="button"
            className="primary"
            onClick={start}
            disabled={busy || !url.trim()}
          >
            {busy ? `Downloading… ${Math.round(percent)}%` : "Download"}
          </button>
          {busy && (
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
