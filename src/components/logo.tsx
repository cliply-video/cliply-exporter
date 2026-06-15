// cliply brand mark: an open "C" ring with a play triangle, fairy-floss
// gradient. Ported from cliply's components/logo.tsx (self-contained here).

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="cliply logo"
      className={className}
      style={{ width: 36, height: 36 }}
    >
      <defs>
        <linearGradient
          id="cliply-mark-gradient"
          x1="16"
          y1="16"
          x2="84"
          y2="84"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#ff9ecd" />
          <stop offset="0.5" stopColor="#b88cf0" />
          <stop offset="1" stopColor="#8ab0f8" />
        </linearGradient>
      </defs>
      <path
        d="M73.3 26.7 A33 33 0 1 0 73.3 73.3"
        stroke="url(#cliply-mark-gradient)"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M44 33 L71 50 L44 67 Z"
        fill="url(#cliply-mark-gradient)"
        stroke="url(#cliply-mark-gradient)"
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span className="wordmark">
        cli<span className="brand">ply</span>
        <span className="oss">oss</span>
      </span>
    </span>
  );
}
