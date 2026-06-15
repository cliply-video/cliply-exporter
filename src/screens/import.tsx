import { open, save } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { copyFile, readXmlFile } from "../lib/api";
import { getVideo, saveParsed } from "../lib/db";
import { parseSportXml } from "../lib/xml";

export function ImportXml({
  videoId,
  onDone,
  onHome,
}: {
  videoId: string;
  onDone: () => void;
  onHome: () => void;
}) {
  const [src, setSrc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTo, setSavedTo] = useState<string | null>(null);

  useEffect(() => {
    getVideo(videoId).then((v) => {
      if (v) setSrc(v.local_path);
    });
  }, [videoId]);

  const pickXml = useCallback(async () => {
    setError(null);
    const path = await open({
      multiple: false,
      filters: [{ name: "Analysis XML", extensions: ["xml"] }],
    });
    if (!path || typeof path !== "string") return;
    setBusy(true);
    try {
      const text = await readXmlFile(path);
      const parsed = parseSportXml(text);
      if (parsed.clips.length === 0) {
        throw new Error("No clips found in this XML");
      }
      await saveParsed(videoId, parsed);
      onDone();
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }, [videoId, onDone]);

  const saveVideo = useCallback(async () => {
    if (!src) return;
    setError(null);
    const dest = await save({
      defaultPath: "video.mp4",
      filters: [{ name: "Video", extensions: ["mp4"] }],
    });
    if (!dest) return;
    setBusy(true);
    try {
      await copyFile(src, dest);
      setSavedTo(dest);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [src]);

  if (savedTo) {
    return (
      <div className="stage">
        <div className="card">
          <p className="eyebrow">Done</p>
          <h2>Video saved</h2>
          <p className="muted" style={{ wordBreak: "break-all" }}>
            {savedTo}
          </p>
          <div className="row" style={{ marginTop: 16 }}>
            <button type="button" onClick={onHome}>
              Download another
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => revealItemInDir(savedTo)}
            >
              Show in Finder
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stage">
      <div className="card">
        <p className="eyebrow">Step 2 · optional</p>
        <h2>Import clips</h2>
        <p className="muted">
          Select a SportsCode / Nacsport XML file to cut clips. No XML? Just keep
          the downloaded video.
        </p>
        {error && <p style={{ color: "var(--destructive)" }}>{error}</p>}
        <div className="row" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="primary"
            onClick={pickXml}
            disabled={busy}
          >
            {busy ? "Working…" : "Choose XML file"}
          </button>
          <button type="button" onClick={saveVideo} disabled={busy || !src}>
            No XML — save the video
          </button>
        </div>
        <button
          type="button"
          onClick={onHome}
          disabled={busy}
          style={{ marginTop: 16, background: "none", border: "none", padding: 0 }}
          className="muted"
        >
          ← New video
        </button>
      </div>
    </div>
  );
}
