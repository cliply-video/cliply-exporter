import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useState } from "react";
import { readXmlFile } from "../lib/api";
import { saveParsed } from "../lib/db";
import { parseSportXml } from "../lib/xml";

export function ImportXml({
  videoId,
  onDone,
}: {
  videoId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback(async () => {
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

  return (
    <div className="center">
      <div className="card">
        <h1>Import clips</h1>
        <p className="muted">
          Select a SportsCode / Nacsport XML file. Each instance becomes a clip;
          tag colors come from the file's rows.
        </p>
        {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}
        <button
          type="button"
          className="primary"
          onClick={pick}
          disabled={busy}
        >
          {busy ? "Importing…" : "Choose XML file"}
        </button>
      </div>
    </div>
  );
}
