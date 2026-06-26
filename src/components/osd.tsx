// Broadcast-OSD primitives, ported from cliply's components/broadcast kit and
// trimmed to what the desktop app needs: corner brackets, status dot/label, the
// blinking REC dot, and the CRT field texture (scanlines + grain).

type Tone = "pink" | "gold" | "white" | "win" | "loss";

export function Corners({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`corners ${className ?? ""}`}>
      <i className="c-tl" />
      <i className="c-tr" />
      <i className="c-bl" />
      <i className="c-br" />
    </span>
  );
}

export function StatusDot({
  tone = "pink",
  blink,
}: {
  tone?: Tone;
  blink?: boolean;
}) {
  return <span className={`dot tone-${tone} ${blink ? "rec" : ""}`} />;
}

export function StatusPill({
  tone = "pink",
  blink,
  children,
}: {
  tone?: Tone;
  blink?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className={`status-pill tone-${tone}`}>
      <StatusDot tone={tone} blink={blink} />
      {children}
    </span>
  );
}

// CRT scanlines + film grain, fixed behind everything. Square-monitor texture
// that opaque panels mask, so only the bare field shows the stripes.
export function FieldTexture() {
  return (
    <>
      <div aria-hidden="true" className="bx-scanlines" />
      <div aria-hidden="true" className="bx-grain" />
    </>
  );
}
