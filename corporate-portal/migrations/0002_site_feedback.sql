CREATE TABLE IF NOT EXISTS corp_site_feedback (
 id TEXT PRIMARY KEY,
 author_id TEXT NOT NULL REFERENCES corp_users(id),
 page_url TEXT NOT NULL,
 excerpt TEXT NOT NULL,
 comment TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS corp_site_feedback_created ON corp_site_feedback(created_at DESC);
