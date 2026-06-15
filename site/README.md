# Landing page

Static, single-file landing for **exporter.cliply.video**. No build step —
`index.html` is self-contained (inline CSS, fonts via Google Fonts, download
links to the GitHub release).

## Deploy

Point any static host at this `site/` directory and set the custom domain
`exporter.cliply.video`:

- **Cloudflare Pages / Vercel:** new project from this repo, build command _none_,
  output/root directory = `site`.
- **GitHub Pages:** serve `site/` (or copy to `/docs`) + add a `CNAME` file with
  `exporter.cliply.video`.

## Maintenance

Download links + the version label are pinned to the current release
(`v0.1.0`). Bump them in `index.html` (search `v0.1.0`) when a new version
ships, or switch the platform buttons to `/releases/latest` for a version-free
link.
