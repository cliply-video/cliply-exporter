import { convertFileSrc } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useT } from "../i18n";
import { type ExportClip, generatePoster } from "../lib/api";
import { type ClipRow, getClips, getVideo } from "../lib/db";
import { ExportDialog } from "./export-dialog";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Group {
  label: string;
  color: string;
  clips: ClipRow[];
}

export function Clips({
  videoId,
  onBack,
}: {
  videoId: string;
  onBack: () => void;
}) {
  const { t } = useT();
  const [clips, setClips] = useState<ClipRow[]>([]);
  const [localPath, setLocalPath] = useState("");
  const [title, setTitle] = useState("clips");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<ClipRow | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const v = await getVideo(videoId);
      if (v) {
        setLocalPath(v.local_path);
        setTitle(v.title);
      }
      const rows = await getClips(videoId);
      setClips(rows);
      setSel(new Set(rows.map((c) => c.id)));
    })();
  }, [videoId]);

  const selectedClips = useMemo<ExportClip[]>(
    () =>
      clips
        .filter((c) => sel.has(c.id))
        .map((c) => ({
          name: c.name,
          startSec: c.start_sec,
          endSec: c.end_sec,
          tagLabel: c.tag_label,
        })),
    [clips, sel],
  );

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const c of clips) {
      const label = c.tag_label ?? t("clips.untagged");
      let g = map.get(label);
      if (!g) {
        g = { label, color: c.tag_color ?? "#7a7a88", clips: [] };
        map.set(label, g);
      }
      g.clips.push(c);
    }
    return Array.from(map.values());
  }, [clips, t]);

  const toggle = useCallback((id: string) => {
    setSel((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((g: Group) => {
    setSel((prev) => {
      const next = new Set(prev);
      const allOn = g.clips.every((c) => next.has(c.id));
      for (const c of g.clips) allOn ? next.delete(c.id) : next.add(c.id);
      return next;
    });
  }, []);

  const allSelected = clips.length > 0 && sel.size === clips.length;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div
        className="row"
        style={{ justifyContent: "space-between", marginBottom: 16 }}
      >
        <button type="button" onClick={onBack}>
          {t("clips.newVideo")}
        </button>
        <div className="row">
          <span className="muted">
            {t("clips.selected", { sel: sel.size, total: clips.length })}
          </span>
          <button
            type="button"
            onClick={() =>
              setSel(allSelected ? new Set() : new Set(clips.map((c) => c.id)))
            }
          >
            {allSelected ? t("clips.clear") : t("clips.selectAll")}
          </button>
          <button
            type="button"
            className="primary"
            disabled={sel.size === 0}
            onClick={() => setExporting(true)}
          >
            {t("clips.export")}
          </button>
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.label} style={{ marginBottom: 24 }}>
          <div
            className="row"
            style={{ marginBottom: 8, cursor: "pointer" }}
            onClick={() => toggleGroup(g)}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: g.color,
                display: "inline-block",
              }}
            />
            <strong>{g.label}</strong>
            <span className="muted">({g.clips.length})</span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            {g.clips.map((c) => (
              <ClipCard
                key={c.id}
                clip={c}
                localPath={localPath}
                selected={sel.has(c.id)}
                onToggle={() => toggle(c.id)}
                onPreview={() => setPreview(c)}
              />
            ))}
          </div>
        </section>
      ))}

      {preview && localPath && (
        <PreviewOverlay
          clip={preview}
          localPath={localPath}
          onClose={() => setPreview(null)}
        />
      )}

      {exporting && localPath && (
        <ExportDialog
          videoId={videoId}
          videoTitle={title}
          sourcePath={localPath}
          clips={selectedClips}
          onClose={() => setExporting(false)}
        />
      )}
    </div>
  );
}

function ClipCard({
  clip,
  localPath,
  selected,
  onToggle,
  onPreview,
}: {
  clip: ClipRow;
  localPath: string;
  selected: boolean;
  onToggle: () => void;
  onPreview: () => void;
}) {
  const { t } = useT();
  const [poster, setPoster] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!localPath) return;
    generatePoster(clip.id, localPath, clip.t_sec)
      .then((p) => {
        if (alive) setPoster(convertFileSrc(p));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [clip.id, clip.t_sec, localPath]);

  return (
    <div
      style={{
        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 10,
        overflow: "hidden",
        background: "var(--panel)",
      }}
    >
      <button
        type="button"
        onClick={onPreview}
        style={{
          padding: 0,
          border: "none",
          borderRadius: 0,
          width: "100%",
          aspectRatio: "16 / 9",
          background: poster ? `center/cover url(${poster})` : "#000",
          display: "block",
        }}
        aria-label="Preview clip"
      />
      <div className="row" style={{ padding: 8, gap: 8 }}>
        <input type="checkbox" checked={selected} onChange={onToggle} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {clip.name ?? clip.tag_label ?? t("clips.clip")}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {fmt(clip.start_sec)}–{fmt(clip.end_sec)}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewOverlay({
  clip,
  localPath,
  onClose,
}: {
  clip: ClipRow;
  localPath: string;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      {/* biome-ignore lint/a11y: media element, click handled on backdrop */}
      <video
        src={convertFileSrc(localPath)}
        controls
        autoPlay
        onClick={(e) => e.stopPropagation()}
        onLoadedMetadata={(e) => {
          e.currentTarget.currentTime = clip.start_sec;
        }}
        onTimeUpdate={(e) => {
          if (e.currentTarget.currentTime >= clip.end_sec) {
            e.currentTarget.pause();
          }
        }}
        style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 10 }}
      >
        <track kind="captions" />
      </video>
    </div>
  );
}
