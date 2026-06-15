import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import {
  type ExportClip,
  type ExportSummary,
  exportClips,
  type ReelMode,
} from "../lib/api";

type Phase = "config" | "running" | "done" | "error";

interface Progress {
  phase: string;
  done: number;
  total: number;
  label: string;
}

export function ExportDialog({
  videoId,
  videoTitle,
  sourcePath,
  clips,
  onClose,
}: {
  videoId: string;
  videoTitle: string;
  sourcePath: string;
  clips: ExportClip[];
  onClose: () => void;
}) {
  const [outDir, setOutDir] = useState<string | null>(null);
  const [individual, setIndividual] = useState(true);
  const [reelMode, setReelMode] = useState<ReelMode>("perTag");
  const [reencode, setReencode] = useState(false);
  const [phase, setPhase] = useState<Phase>("config");
  const [prog, setProg] = useState<Progress | null>(null);
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const un = listen<{ videoId: string } & Progress>("export-progress", (e) => {
      if (e.payload.videoId === videoId) setProg(e.payload);
    });
    return () => {
      un.then((f) => f());
    };
  }, [videoId]);

  const pickDir = useCallback(async () => {
    const dir = await open({ directory: true, multiple: false });
    if (typeof dir === "string") setOutDir(dir);
  }, []);

  const run = useCallback(async () => {
    if (!outDir) return;
    setPhase("running");
    setError(null);
    try {
      const result = await exportClips({
        videoId,
        videoTitle,
        sourcePath,
        outDir,
        clips,
        individualClips: individual,
        reelMode,
        reencode,
      });
      setSummary(result);
      setPhase("done");
    } catch (e) {
      setError(String(e));
      setPhase("error");
    }
  }, [
    outDir,
    videoId,
    videoTitle,
    sourcePath,
    clips,
    individual,
    reelMode,
    reencode,
  ]);

  const pct =
    prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div className="card">
        <h1>Export {clips.length} clips</h1>

        {phase === "config" && (
          <>
            <div className="row" style={{ margin: "12px 0" }}>
              <button type="button" onClick={pickDir}>
                Choose folder…
              </button>
              <span className="muted" style={{ fontSize: 12 }}>
                {outDir ?? "no folder chosen"}
              </span>
            </div>
            <label className="row" style={{ margin: "8px 0" }}>
              <input
                type="checkbox"
                checked={individual}
                onChange={(e) => setIndividual(e.target.checked)}
              />
              Individual clips (folder per tag)
            </label>
            <label className="row" style={{ margin: "8px 0" }}>
              Reels:
              <select
                value={reelMode}
                onChange={(e) => setReelMode(e.target.value as ReelMode)}
                style={{
                  background: "var(--bg)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "4px 8px",
                }}
              >
                <option value="none">None</option>
                <option value="perTag">One per tag</option>
                <option value="combined">Combined (all clips)</option>
              </select>
            </label>
            <label className="row" style={{ margin: "8px 0" }}>
              <input
                type="checkbox"
                checked={reencode}
                onChange={(e) => setReencode(e.target.checked)}
              />
              Re-encode (frame-accurate, slower) — off = fast stream copy
            </label>
            <div
              className="row"
              style={{ justifyContent: "flex-end", marginTop: 16 }}
            >
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={run}
                disabled={!outDir}
              >
                Export
              </button>
            </div>
          </>
        )}

        {phase === "running" && (
          <>
            <p className="muted">
              {prog
                ? `${prog.phase === "reel" ? "Building reel" : "Cutting"}: ${prog.label} (${prog.done}/${prog.total})`
                : "Starting…"}
            </p>
            <div className="bar">
              <span style={{ width: `${pct}%` }} />
            </div>
          </>
        )}

        {phase === "done" && summary && (
          <>
            <p>
              Exported {summary.clips} clips and {summary.reels} reels.
            </p>
            <div
              className="row"
              style={{ justifyContent: "flex-end", marginTop: 16 }}
            >
              <button type="button" onClick={onClose}>
                Close
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => revealItemInDir(summary.outDir)}
              >
                Open folder
              </button>
            </div>
          </>
        )}

        {phase === "error" && (
          <>
            <p style={{ color: "#ff6b6b" }}>{error}</p>
            <div
              className="row"
              style={{ justifyContent: "flex-end", marginTop: 16 }}
            >
              <button type="button" onClick={onClose}>
                Close
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => setPhase("config")}
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
