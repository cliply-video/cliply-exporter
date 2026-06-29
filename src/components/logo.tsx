// cliply brand mark: an open "C" ring + play triangle, monochrome pink. On hover
// the wordmark RGB-splits (glitch) and three signal arcs ripple off the top of
// the mark like a transmitter — ported from cliply's broadcast BxMark/BxWordmark.

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="cliply logo"
      className={className}
    >
      <g
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      >
        <path className="bx-signal-wave bx-signal-1" d="M41 16 Q50 8 59 16" />
        <path className="bx-signal-wave bx-signal-2" d="M36 13 Q50 1 64 13" />
        <path className="bx-signal-wave bx-signal-3" d="M31 10 Q50 -6 69 10" />
      </g>
      <path
        d="M73.3 26.7 A33 33 0 1 0 73.3 73.3"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M44 33 L71 50 L44 67 Z" fill="currentColor" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo bx-glitch-trigger">
      <LogoMark />
      <span className="wordmark">
        <span className="bx-glitch">
          <span aria-hidden="true" className="bx-glitch-layer bx-glitch-a">
            cliply
          </span>
          <span aria-hidden="true" className="bx-glitch-layer bx-glitch-b">
            cliply
          </span>
          <span className="bx-glitch-base">cliply</span>
        </span>
        <span className="oss">exporter</span>
      </span>
    </span>
  );
}
