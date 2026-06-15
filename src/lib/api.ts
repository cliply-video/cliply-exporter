import { invoke } from "@tauri-apps/api/core";

export type BinariesStatus = {
  ffmpeg: boolean;
  ffprobe: boolean;
  ytdlp: boolean;
};

export const binariesStatus = () =>
  invoke<BinariesStatus>("binaries_status");

export const downloadBinaries = () => invoke<void>("download_binaries");

export type DownloadOutcome = {
  status: "done" | "cancelled";
  path: string | null;
};

export const downloadYoutube = (videoId: string, url: string) =>
  invoke<DownloadOutcome>("download_youtube", { videoId, url });

export const cancelDownload = (videoId: string) =>
  invoke<void>("cancel_download", { videoId });

export const readXmlFile = (path: string) =>
  invoke<string>("read_xml_file", { path });

export const generatePoster = (clipId: string, src: string, tSec: number) =>
  invoke<string>("generate_poster", { clipId, src, tSec });
