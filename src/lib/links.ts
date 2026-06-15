import { openUrl } from "@tauri-apps/plugin-opener";

export const GITHUB_URL = "https://github.com/ianaya89/cliply-oss";
export const CLIPLY_URL = "https://cliply.video";

export const openExternal = (url: string) => {
  openUrl(url).catch(() => {});
};
