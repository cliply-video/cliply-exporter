//! YouTube download via yt-dlp. Unlike the cliply desktop app (which bundles
//! yt-dlp as a signed sidecar), this spawns the *resolved* binary (managed
//! download or system PATH) directly through tokio.

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::binaries::{resolve, Tool};

#[derive(Default)]
pub struct DownloadState {
    cancel: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    video_id: String,
    percent: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadOutcome {
    status: &'static str, // "done" | "cancelled"
    path: Option<String>,
    title: Option<String>,
}

fn es(e: impl std::fmt::Display) -> String {
    e.to_string()
}

fn media_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(es)?.join("media");
    std::fs::create_dir_all(&dir).map_err(es)?;
    Ok(dir)
}

fn emit(app: &AppHandle, video_id: &str, percent: f64) {
    let _ = app.emit(
        "media-download",
        Progress {
            video_id: video_id.to_string(),
            percent,
        },
    );
}

/// Downloads a video URL with yt-dlp into <app-data>/media/<video_id>.mp4.
/// h264-first format selection (WKWebView can't decode AV1 before M3). Merges
/// best video+audio when ffmpeg is available, else best progressive mp4.
#[tauri::command]
pub async fn download_youtube(
    app: AppHandle,
    state: State<'_, DownloadState>,
    video_id: String,
    url: String,
) -> Result<DownloadOutcome, String> {
    let ytdlp = resolve(&app, Tool::YtDlp)
        .ok_or_else(|| "yt-dlp is not available — set it up on the Home screen".to_string())?;
    let ffmpeg = resolve(&app, Tool::Ffmpeg);

    let out = media_dir(&app)?.join(format!("{video_id}.mp4"));
    let out_str = out.to_string_lossy().into_owned();
    let info_path = out.with_extension("info.json");

    let mut args: Vec<String> = vec![
        "--no-playlist".into(),
        "--newline".into(),
        "--continue".into(),
        "-o".into(),
        out_str.clone(),
        // Capture the real title without affecting the media output path.
        "--write-info-json".into(),
        "-o".into(),
        format!("infojson:{}", info_path.to_string_lossy()),
    ];
    if let Some(ff) = &ffmpeg {
        let ff_dir = ff
            .parent()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_default();
        args.extend([
            "--ffmpeg-location".into(),
            ff_dir,
            "-f".into(),
            "bv*[vcodec^=avc1][ext=mp4]+ba[ext=m4a]/bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b".into(),
            "--merge-output-format".into(),
            "mp4".into(),
        ]);
    } else {
        args.extend(["-f".into(), "b[ext=mp4]".into()]);
    }
    args.push(url);

    let cancel = Arc::new(AtomicBool::new(false));
    state
        .cancel
        .lock()
        .unwrap()
        .insert(video_id.clone(), cancel.clone());

    let spawn = Command::new(&ytdlp)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();
    let mut child = match spawn {
        Ok(c) => c,
        Err(e) => {
            state.cancel.lock().unwrap().remove(&video_id);
            return Err(es(e));
        }
    };

    // Drain stderr into a buffer so a full pipe can't block the child.
    let err_buf = Arc::new(Mutex::new(String::new()));
    if let Some(serr) = child.stderr.take() {
        let eb = err_buf.clone();
        tokio::spawn(async move {
            let mut el = BufReader::new(serr).lines();
            while let Ok(Some(line)) = el.next_line().await {
                let mut g = eb.lock().unwrap();
                g.push_str(&line);
                g.push('\n');
            }
        });
    }

    if let Some(sout) = child.stdout.take() {
        let mut lines = BufReader::new(sout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if cancel.load(Ordering::Relaxed) {
                let _ = child.start_kill();
                break;
            }
            // "[download]  42.3% of ..." → progress event
            if let Some(rest) = line.trim().strip_prefix("[download]") {
                if let Some(pct) = rest.trim().split('%').next() {
                    if let Ok(p) = pct.trim().parse::<f64>() {
                        emit(&app, &video_id, p);
                    }
                }
            }
        }
    }

    let status = child.wait().await.map_err(es)?;
    let was_cancelled = cancel.load(Ordering::Relaxed);
    state.cancel.lock().unwrap().remove(&video_id);

    if was_cancelled {
        let _ = std::fs::remove_file(&info_path);
        return Ok(DownloadOutcome {
            status: "cancelled",
            path: None,
            title: None,
        });
    }
    if !status.success() {
        let tail = err_buf.lock().unwrap().clone();
        return Err(if tail.trim().is_empty() {
            "yt-dlp failed".to_string()
        } else {
            format!("yt-dlp: {}", tail.trim())
        });
    }
    if !out.exists() {
        return Err("yt-dlp finished but produced no file".to_string());
    }

    // Pull the title out of the info json, then drop the file.
    let title = std::fs::read_to_string(&info_path)
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .and_then(|v| {
            v.get("title")
                .and_then(|t| t.as_str())
                .map(|s| s.to_string())
        });
    let _ = std::fs::remove_file(&info_path);

    emit(&app, &video_id, 100.0);
    Ok(DownloadOutcome {
        status: "done",
        path: Some(out_str),
        title,
    })
}

/// Signals an in-flight download to stop; the `.part` file is kept for resume.
#[tauri::command]
pub fn cancel_download(state: State<'_, DownloadState>, video_id: String) {
    if let Some(flag) = state.cancel.lock().unwrap().get(&video_id) {
        flag.store(true, Ordering::Relaxed);
    }
}
