import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";

type BinariesStatus = {
  ffmpeg: boolean;
  ffprobe: boolean;
  ytdlp: boolean;
};

const ready = (s: BinariesStatus | null) =>
  !!s && s.ffmpeg && s.ffprobe && s.ytdlp;

export function App() {
  const [status, setStatus] = useState<BinariesStatus | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await invoke<BinariesStatus>("binaries_status"));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const un = listen<{ percent: number }>("binary-download", (e) =>
      setPercent(e.payload.percent),
    );
    return () => {
      un.then((f) => f());
    };
  }, []);

  const download = useCallback(async () => {
    setError(null);
    setDownloading(true);
    setPercent(0);
    try {
      await invoke("download_binaries");
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setDownloading(false);
    }
  }, [refresh]);

  if (!ready(status)) {
    return (
      <div className="center">
        <div className="card">
          <h1>Setting up</h1>
          <p className="muted">
            Cliply needs <code>ffmpeg</code> and <code>yt-dlp</code>. They
            download once from their official sources and are verified by
            checksum.
          </p>
          <ul className="muted">
            <li>ffmpeg: {status?.ffmpeg ? "ready" : "missing"}</li>
            <li>ffprobe: {status?.ffprobe ? "ready" : "missing"}</li>
            <li>yt-dlp: {status?.ytdlp ? "ready" : "missing"}</li>
          </ul>
          {downloading && (
            <div className="bar" style={{ margin: "16px 0" }}>
              <span style={{ width: `${percent}%` }} />
            </div>
          )}
          {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}
          <button
            type="button"
            className="primary"
            onClick={download}
            disabled={downloading}
          >
            {downloading ? `Downloading… ${Math.round(percent)}%` : "Download"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="center">
      <div className="card">
        <h1>Cliply OSS</h1>
        <p className="muted">
          Dependencies ready. Paste a YouTube URL and import an analysis XML to
          generate clips.
        </p>
        <p className="muted">Flow UI lands in P2 — download + XML import.</p>
      </div>
    </div>
  );
}
