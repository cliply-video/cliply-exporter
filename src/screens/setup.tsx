import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import { type BinariesStatus, downloadBinaries } from "../lib/api";

export function Setup({
  status,
  onReady,
}: {
  status: BinariesStatus | null;
  onReady: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
      await downloadBinaries();
      onReady();
    } catch (e) {
      setError(String(e));
    } finally {
      setDownloading(false);
    }
  }, [onReady]);

  return (
    <div className="stage">
      <div className="card">
        <p className="eyebrow">First run</p>
        <h2>Setting up</h2>
        <p className="muted">
          Cliply needs <code>ffmpeg</code> and <code>yt-dlp</code>. They
          download once from their official sources, are verified by checksum,
          and never bundled. Already have them on your PATH? They're used
          automatically.
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
        <div className="row">
          <button
            type="button"
            className="primary"
            onClick={download}
            disabled={downloading}
          >
            {downloading ? `Downloading… ${Math.round(percent)}%` : "Download"}
          </button>
          <button type="button" onClick={onReady} disabled={downloading}>
            Re-check PATH
          </button>
        </div>
      </div>
    </div>
  );
}
