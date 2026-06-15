# Cliply Export

Open-source desktop clip cutter. Paste a YouTube URL, import a sports-analysis
XML (SportsCode / Nacsport `ALL_INSTANCES`), review the generated clips, pick
the ones you want, and export them as MP4s with ffmpeg.

Fully offline and local — no account, no cloud, no telemetry.

> Want hosting, teams, sharing and live collaboration? Check out the full app at
> [cliply.video](https://cliply.video).

## Install

Grab a build from [Releases](https://github.com/cliply-video/cliply-exporter/releases):
macOS `.dmg`, Windows `.exe`, Linux `.AppImage` / `.deb`. Unsigned for now — on
macOS, right-click → **Open** the first time to get past Gatekeeper.

## Runtime dependencies

Two external tools, never bundled (keeps the app permissively licensed and the
download small):

- **yt-dlp** (Unlicense) — auto-downloaded on first run (pinned, SHA256-verified),
  all platforms.
- **ffmpeg / ffprobe** (LGPL) — auto-downloaded on macOS (evermeet static build).
  On Windows/Linux, install it yourself (package manager) or point at it.

Already have them on your `PATH` (e.g. Homebrew)? Those are used and the download
is skipped. Override explicitly with `FFMPEG_PATH`, `FFPROBE_PATH`, `YTDLP_PATH`.

## Status

| Phase | Scope | State |
| ----- | ----- | ----- |
| P1 | App skeleton + binary auto-download | ✅ |
| P2 | Download + XML import + clip list | ✅ |
| P3 | Export (clips + folder-per-tag + reels) | ✅ |
| P4 | Cross-platform packaging + CI | 🚧 |

i18n: English + Spanish (toggle in the title bar). Roadmap: [`docs/plan.md`](docs/plan.md).

## Develop

Prereqs: Rust (stable), Node 20+.

```bash
npm install
npm run app        # tauri dev (Vite + Rust)
npm run app:build  # production bundle
```

CI (`.github/workflows/ci.yml`) runs typecheck + build and `cargo check`/`test`
on every push. Pushing a `vX.Y.Z` tag triggers `release.yml`, which builds all
four targets (macOS arm64/x64, Windows, Linux) and opens a draft GitHub release.

App icon: edit `src-tauri/icons/icon-source.svg`, then
`rsvg-convert -w 1024 -h 1024 src-tauri/icons/icon-source.svg -o /tmp/i.png &&
npx tauri icon /tmp/i.png -o src-tauri/icons`.

## License

[Apache-2.0](LICENSE). ffmpeg and yt-dlp are downloaded at runtime as separate
binaries and are not distributed with this app; see their respective licenses.
