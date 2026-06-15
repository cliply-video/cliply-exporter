# Cliply Exporter

Open-source desktop clip cutter. Paste a YouTube URL, import a sports-analysis
XML (SportsCode / Nacsport `ALL_INSTANCES`), review the generated clips, pick
the ones you want, and export them as MP4s with ffmpeg.

Fully offline and local — no account, no cloud, no telemetry.

## Status

Early. Roadmap lives in [`docs/plan.md`](docs/plan.md).

| Phase | Scope | State |
| ----- | ----- | ----- |
| P1 | App skeleton + binary auto-download | in progress |
| P2 | Download + XML import + clip list | todo |
| P3 | Export (clips + folder-per-tag + reels) | todo |
| P4 | Cross-platform packaging + CI | todo |

## Runtime dependencies

The app uses two external tools, downloaded automatically on first run from
their official releases (SHA256-verified, cached in app-data) — never bundled:

- **ffmpeg** (LGPL) — clip cutting and reel concat
- **yt-dlp** (Unlicense) — YouTube download

Already have them on your `PATH` (e.g. via Homebrew)? The app uses those and
skips the download. Override explicitly with `FFMPEG_PATH`, `FFPROBE_PATH`,
`YTDLP_PATH`.

## Develop

Prereqs: Rust (stable), Node 20+.

```bash
npm install
npm run app        # tauri dev (Vite + Rust)
npm run app:build  # production bundle
```

## License

[Apache-2.0](LICENSE). ffmpeg and yt-dlp are downloaded at runtime as separate
binaries and are not distributed with this app; see their respective licenses.
