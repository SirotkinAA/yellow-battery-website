-- Additive migration. Existing portal tables and active calculator dataset are untouched.
CREATE TABLE IF NOT EXISTS catalog_channel_releases (
 release_id TEXT NOT NULL, channel TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(channel,release_id)
);
CREATE TABLE IF NOT EXISTS catalog_channel_heads (
 channel TEXT PRIMARY KEY, release_id TEXT NOT NULL,
 FOREIGN KEY(channel,release_id) REFERENCES catalog_channel_releases(channel,release_id)
);
