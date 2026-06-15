//! Local media helpers: read analysis XML (BOM-aware) and generate clip
//! poster frames with ffmpeg.

use std::path::PathBuf;
use std::process::Stdio;

use tauri::{AppHandle, Manager};
use tokio::process::Command;

use crate::binaries::{resolve, Tool};

fn es(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Reads an XML file and decodes it, honoring a UTF-16/UTF-8 BOM. NacSport and
/// SportsCode (Windows) frequently export UTF-16, which a plain UTF-8 read
/// would corrupt.
#[tauri::command]
pub fn read_xml_file(path: String) -> Result<String, String> {
    let buf = std::fs::read(&path).map_err(es)?;
    Ok(decode(&buf))
}

fn decode(buf: &[u8]) -> String {
    if buf.starts_with(&[0xff, 0xfe]) {
        let u: Vec<u16> = buf[2..]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        return String::from_utf16_lossy(&u);
    }
    if buf.starts_with(&[0xfe, 0xff]) {
        let u: Vec<u16> = buf[2..]
            .chunks_exact(2)
            .map(|c| u16::from_be_bytes([c[0], c[1]]))
            .collect();
        return String::from_utf16_lossy(&u);
    }
    if buf.starts_with(&[0xef, 0xbb, 0xbf]) {
        return String::from_utf8_lossy(&buf[3..]).into_owned();
    }
    String::from_utf8_lossy(buf).into_owned()
}

fn posters_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(es)?.join("posters");
    std::fs::create_dir_all(&dir).map_err(es)?;
    Ok(dir)
}

/// Extracts a single frame at `t_sec` from `src` to <app-data>/posters/<id>.jpg
/// and returns its path. Cached: re-requesting an existing poster is a no-op.
#[tauri::command]
pub async fn generate_poster(
    app: AppHandle,
    clip_id: String,
    src: String,
    t_sec: f64,
) -> Result<String, String> {
    let out = posters_dir(&app)?.join(format!("{clip_id}.jpg"));
    let out_str = out.to_string_lossy().into_owned();
    if out.is_file() {
        return Ok(out_str);
    }
    let ffmpeg =
        resolve(&app, Tool::Ffmpeg).ok_or_else(|| "ffmpeg is not available".to_string())?;

    let status = Command::new(&ffmpeg)
        .args([
            "-y",
            "-ss",
            &format!("{t_sec:.3}"),
            "-i",
            &src,
            "-frames:v",
            "1",
            "-q:v",
            "2",
            &out_str,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map_err(es)?;

    if !status.success() || !out.is_file() {
        return Err("could not generate poster".to_string());
    }
    Ok(out_str)
}
