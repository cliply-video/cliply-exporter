//! Runtime dependency management for ffmpeg, ffprobe and yt-dlp.
//!
//! These are NOT bundled (avoids GPL redistribution of ffmpeg + DMG bloat).
//! Resolution order: env override -> managed download (<app-data>/bin) ->
//! a binary already on the system PATH. Managed downloads come from each
//! tool's official public release and are SHA256-verified before use — an
//! unverified binary is never run.

use std::io::Write;
use std::path::{Path, PathBuf};

use futures_util::StreamExt;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Copy)]
pub enum Tool {
    Ffmpeg,
    Ffprobe,
    YtDlp,
}

impl Tool {
    const ALL: [Tool; 3] = [Tool::Ffmpeg, Tool::Ffprobe, Tool::YtDlp];

    fn key(self) -> &'static str {
        match self {
            Tool::Ffmpeg => "ffmpeg",
            Tool::Ffprobe => "ffprobe",
            Tool::YtDlp => "yt-dlp",
        }
    }

    fn env_var(self) -> &'static str {
        match self {
            Tool::Ffmpeg => "FFMPEG_PATH",
            Tool::Ffprobe => "FFPROBE_PATH",
            Tool::YtDlp => "YTDLP_PATH",
        }
    }
}

// Zip is only constructed on platforms whose ffmpeg source is a zip (Windows).
#[allow(dead_code)]
#[derive(Clone, Copy)]
enum Archive {
    /// The downloaded file is the executable itself (yt-dlp).
    Raw,
    /// The executable lives inside a zip; `member` matches the entry name.
    Zip,
}

struct Source {
    url: &'static str,
    /// SHA256 of the downloaded file. Empty = not yet pinned (download refused).
    sha256: &'static str,
    archive: Archive,
    /// For Zip sources, the file basename to extract.
    member: &'static str,
}

fn exe_name(name: &str) -> String {
    if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    }
}

/// Pinned official download source for a tool on the current platform.
///
/// Versions are pinned with verified SHA256 (bump deliberately on release).
/// `None` means no managed download for this platform → fall back to a
/// system/PATH copy (see `resolve`). yt-dlp: pinned 2026.06.09 (raw binary,
/// all platforms). ffmpeg/ffprobe: macOS via the evermeet 8.1.1 static zip;
/// Windows/Linux not yet bundled — use system ffmpeg or set FFMPEG_PATH.
fn source(tool: Tool) -> Option<Source> {
    match tool {
        Tool::YtDlp => {
            #[cfg(target_os = "macos")]
            return Some(Source {
                url: "https://github.com/yt-dlp/yt-dlp/releases/download/2026.06.09/yt-dlp_macos",
                sha256: "b82c3626952e6c14eaf654cc565866775ffd0b9ffb7021628ac59b42c2f4f244",
                archive: Archive::Raw,
                member: "yt-dlp",
            });
            #[cfg(target_os = "windows")]
            return Some(Source {
                url: "https://github.com/yt-dlp/yt-dlp/releases/download/2026.06.09/yt-dlp.exe",
                sha256: "3a48cb955d55c8821b60ccbdbbc6f61bc958f2f3d3b7ad5eaf3d83a543293a27",
                archive: Archive::Raw,
                member: "yt-dlp.exe",
            });
            #[cfg(target_os = "linux")]
            return Some(Source {
                url: "https://github.com/yt-dlp/yt-dlp/releases/download/2026.06.09/yt-dlp_linux",
                sha256: "bf8aac79b72287a6d2043074415132558b43743a8f9461a22b0141e90f16ce66",
                archive: Archive::Raw,
                member: "yt-dlp",
            });
            #[allow(unreachable_code)]
            None
        }
        Tool::Ffmpeg | Tool::Ffprobe => {
            #[cfg(target_os = "macos")]
            {
                // evermeet 8.1.1 static build (x86_64; runs on arm64 via Rosetta).
                let (url, sha256, member) = match tool {
                    Tool::Ffprobe => (
                        "https://evermeet.cx/ffmpeg/ffprobe-8.1.1.zip",
                        "aeade29dee3c3844e9bcc974f4ae4b29cc4f87994177d77003a8589fa531009e",
                        "ffprobe",
                    ),
                    _ => (
                        "https://evermeet.cx/ffmpeg/ffmpeg-8.1.1.zip",
                        "4610988e2f54c243c50da73a09e4e2c36d9bb77546f9aa6c84cb328dcb1a98c1",
                        "ffmpeg",
                    ),
                };
                return Some(Source {
                    url,
                    sha256,
                    archive: Archive::Zip,
                    member,
                });
            }
            #[allow(unreachable_code)]
            {
                let _ = tool;
                None
            }
        }
    }
}

fn managed_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("bin");
    Ok(dir)
}

fn find_on_path(name: &str) -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path) {
            let cand = dir.join(name);
            if cand.is_file() {
                return Some(cand);
            }
        }
    }
    // GUI apps on macOS inherit a minimal PATH that omits Homebrew.
    for base in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"] {
        let cand = Path::new(base).join(name);
        if cand.is_file() {
            return Some(cand);
        }
    }
    None
}

/// Resolves an executable: env override, then managed download, then PATH.
pub fn resolve(app: &AppHandle, tool: Tool) -> Option<PathBuf> {
    if let Some(p) = std::env::var_os(tool.env_var()) {
        let p = PathBuf::from(p);
        if p.is_file() {
            return Some(p);
        }
    }
    if let Ok(dir) = managed_dir(app) {
        let p = dir.join(exe_name(tool.key()));
        if p.is_file() {
            return Some(p);
        }
    }
    find_on_path(&exe_name(tool.key()))
}

#[derive(Serialize)]
pub struct BinariesStatus {
    ffmpeg: bool,
    ffprobe: bool,
    ytdlp: bool,
}

#[tauri::command]
pub fn binaries_status(app: AppHandle) -> BinariesStatus {
    BinariesStatus {
        ffmpeg: resolve(&app, Tool::Ffmpeg).is_some(),
        ffprobe: resolve(&app, Tool::Ffprobe).is_some(),
        ytdlp: resolve(&app, Tool::YtDlp).is_some(),
    }
}

#[derive(Clone, Serialize)]
struct DownloadProgress {
    percent: f64,
}

fn emit(app: &AppHandle, percent: f64) {
    let _ = app.emit("binary-download", DownloadProgress { percent });
}

/// Downloads any missing tools into <app-data>/bin, verifying SHA256. Emits
/// "binary-download" with a 0–100 percent spanning all missing tools.
#[tauri::command]
pub async fn download_binaries(app: AppHandle) -> Result<(), String> {
    let missing: Vec<Tool> = Tool::ALL
        .into_iter()
        .filter(|t| resolve(&app, *t).is_none())
        .collect();
    if missing.is_empty() {
        emit(&app, 100.0);
        return Ok(());
    }

    let dir = managed_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let slice = 100.0 / missing.len() as f64;

    for (i, tool) in missing.iter().enumerate() {
        let src = source(*tool).ok_or_else(|| {
            format!(
                "{}: no managed download for this platform — install it (e.g. your package manager) or set {}",
                tool.key(),
                tool.env_var()
            )
        })?;
        if src.sha256.is_empty() {
            return Err(format!("{}: download checksum not pinned", tool.key()));
        }
        let dest = dir.join(exe_name(tool.key()));
        download_one(&app, &dir, &src, &dest, slice * i as f64, slice).await?;
    }
    emit(&app, 100.0);
    Ok(())
}

async fn download_one(
    app: &AppHandle,
    dir: &Path,
    src: &Source,
    dest: &Path,
    base_percent: f64,
    span: f64,
) -> Result<(), String> {
    let res = reqwest::get(src.url).await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("download failed: HTTP {}", res.status()));
    }
    let total = res.content_length().unwrap_or(0);

    let tmp = dir.join(format!("{}.download.tmp", src.member));
    let mut file = std::fs::File::create(&tmp).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut received: u64 = 0;
    let mut last = -1.0_f64;
    let mut stream = res.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        hasher.update(&chunk);
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        received += chunk.len() as u64;
        if total > 0 {
            let percent = base_percent + (received as f64 / total as f64) * span;
            if percent - last >= 1.0 {
                last = percent;
                emit(app, percent);
            }
        }
    }
    file.flush().map_err(|e| e.to_string())?;
    drop(file);

    let actual = format!("{:x}", hasher.finalize());
    if actual != src.sha256 {
        let _ = std::fs::remove_file(&tmp);
        return Err(format!(
            "{}: checksum mismatch (got {actual}) — refusing to install",
            src.member
        ));
    }

    match src.archive {
        Archive::Raw => {
            std::fs::rename(&tmp, dest).map_err(|e| e.to_string())?;
        }
        Archive::Zip => {
            extract_zip_member(&tmp, src.member, dest)?;
            let _ = std::fs::remove_file(&tmp);
        }
    }
    set_executable(dest)?;
    Ok(())
}

fn extract_zip_member(zip_path: &Path, member: &str, dest: &Path) -> Result<(), String> {
    let f = std::fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(f).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();
        if name == member || name.ends_with(&format!("/{member}")) {
            let mut out = std::fs::File::create(dest).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
            return Ok(());
        }
    }
    Err(format!("{member} not found in archive"))
}

fn set_executable(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(unix))]
    {
        let _ = path;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pinned_sources_have_valid_sha256() {
        for tool in Tool::ALL {
            if let Some(s) = source(tool) {
                assert_eq!(s.sha256.len(), 64, "{}: sha must be 64 hex chars", tool.key());
                assert!(
                    s.sha256.bytes().all(|b| b.is_ascii_hexdigit()),
                    "{}: sha must be hex",
                    tool.key()
                );
            }
        }
    }

    #[test]
    fn ytdlp_always_has_a_managed_source() {
        assert!(source(Tool::YtDlp).is_some());
    }
}
