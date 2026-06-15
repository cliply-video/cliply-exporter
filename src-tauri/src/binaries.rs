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

/// Per-platform official download source for a tool.
///
/// TODO(P1 gate): pin the `sha256` for each entry against the exact release
/// asset before shipping. Until pinned, `download_binaries` refuses the tool
/// and resolution falls back to a system-installed copy.
fn source(tool: Tool) -> Option<Source> {
    match tool {
        Tool::YtDlp => {
            // yt-dlp ships a raw standalone binary per platform.
            #[cfg(target_os = "macos")]
            return Some(Source {
                url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos",
                sha256: "",
                archive: Archive::Raw,
                member: "yt-dlp",
            });
            #[cfg(target_os = "windows")]
            return Some(Source {
                url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
                sha256: "",
                archive: Archive::Raw,
                member: "yt-dlp.exe",
            });
            #[cfg(target_os = "linux")]
            return Some(Source {
                url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux",
                sha256: "",
                archive: Archive::Raw,
                member: "yt-dlp",
            });
            #[allow(unreachable_code)]
            None
        }
        // ffmpeg/ffprobe archive formats differ per platform (mac evermeet .7z,
        // win gyan .zip, linux johnvansickle .tar.xz). Windows .zip is wired;
        // mac/linux extraction lands with the SHA pins (see plan §4 open items).
        Tool::Ffmpeg | Tool::Ffprobe => {
            #[cfg(target_os = "windows")]
            {
                let member = match tool {
                    Tool::Ffprobe => "ffprobe.exe",
                    _ => "ffmpeg.exe",
                };
                return Some(Source {
                    url: "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
                    sha256: "",
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
        let src = source(*tool)
            .ok_or_else(|| format!("{}: no official source for this platform", tool.key()))?;
        if src.sha256.is_empty() {
            return Err(format!(
                "{}: download checksum not pinned yet — install it via your package manager for now",
                tool.key()
            ));
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
