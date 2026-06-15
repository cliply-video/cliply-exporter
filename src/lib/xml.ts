// SportsCode / Nacsport-compatible XML (seconds-based). Parses <ALL_INSTANCES>
// into clips and <ROWS> into tag colors. Ported/trimmed from cliply's
// components/analytics/xml.ts (DOMParser is available in the webview).

export interface XmlClip {
  start: number;
  end: number;
  code: string;
  flags: string[];
}

export interface XmlRow {
  code: string;
  color: string; // CSS hex
}

export interface ParsedXml {
  clips: XmlClip[];
  rows: Map<string, XmlRow>; // keyed by code.toLowerCase()
}

// R/G/B in NacSport XML are 16-bit (0–65535); scale to 8-bit.
function channel(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(255, Math.round(v / 257)));
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => channel(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function parseSportXml(text: string): ParsedXml {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Invalid XML file");
  }

  const clips: XmlClip[] = [];
  for (const inst of Array.from(doc.querySelectorAll("instance"))) {
    const start = Number(inst.querySelector("start")?.textContent ?? "");
    const end = Number(inst.querySelector("end")?.textContent ?? "");
    const code = inst.querySelector("code")?.textContent?.trim() || "Clip";
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      continue;
    }
    const flags: string[] = [];
    for (const label of Array.from(inst.querySelectorAll("label"))) {
      const group = label.querySelector("group")?.textContent?.trim();
      const t = label.querySelector("text")?.textContent?.trim();
      if (group === "Flags" && t) flags.push(t);
    }
    clips.push({ start, end, code, flags });
  }

  const rows = new Map<string, XmlRow>();
  for (const row of Array.from(doc.querySelectorAll("ROWS > row"))) {
    const code = row.querySelector("code")?.textContent?.trim();
    if (!code) continue;
    const r = Number(row.querySelector("R")?.textContent ?? "");
    const g = Number(row.querySelector("G")?.textContent ?? "");
    const b = Number(row.querySelector("B")?.textContent ?? "");
    const hasColor =
      Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b);
    rows.set(code.toLowerCase(), {
      code,
      color: hasColor ? toHex(r, g, b) : "#7a7a88",
    });
  }

  return { clips, rows };
}
