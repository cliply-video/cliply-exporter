-- Local-only schema. No org_id, no user_id, no auth — fully offline.

CREATE TABLE IF NOT EXISTS videos (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  local_path  TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

-- tag types parsed from XML <ROWS>
CREATE TABLE IF NOT EXISTS tag_types (
  id          TEXT PRIMARY KEY,
  video_id    TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  label       TEXT NOT NULL,
  color       TEXT NOT NULL,            -- CSS hex, from R/G/B 0-65535
  pre_sec     REAL NOT NULL DEFAULT 3.0,
  post_sec    REAL NOT NULL DEFAULT 5.0,
  row_top     INTEGER NOT NULL DEFAULT 0
);

-- tag qualifiers from <label group="Flags">
CREATE TABLE IF NOT EXISTS tag_variants (
  id          TEXT PRIMARY KEY,
  tag_type_id TEXT NOT NULL REFERENCES tag_types(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  label       TEXT NOT NULL,
  color       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- clips parsed from XML <ALL_INSTANCES>
CREATE TABLE IF NOT EXISTS clips (
  id          TEXT PRIMARY KEY,
  video_id    TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  tag_type_id TEXT REFERENCES tag_types(id),
  name        TEXT,
  t_sec       REAL NOT NULL,
  start_sec   REAL NOT NULL,
  end_sec     REAL NOT NULL,
  is_manual   INTEGER NOT NULL DEFAULT 0,
  is_open     INTEGER NOT NULL DEFAULT 0,
  poster_path TEXT
);

CREATE TABLE IF NOT EXISTS clip_variants (
  clip_id    TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES tag_variants(id) ON DELETE CASCADE,
  PRIMARY KEY (clip_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_clips_video ON clips(video_id);
CREATE INDEX IF NOT EXISTS idx_tag_types_video ON tag_types(video_id);
