-- Private employee records. Never expose these tables through the public catalogue API.
CREATE TABLE IF NOT EXISTS corp_users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 phone TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 roles TEXT NOT NULL CHECK(json_valid(roles)),
 status TEXT NOT NULL CHECK(status IN ('invited','active','disabled')),
 password_hash TEXT, email_verified INTEGER NOT NULL DEFAULT 0,
 phone_verified INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS corp_sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES corp_users(id),
 user_version INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS corp_sessions_user ON corp_sessions(user_id);
CREATE TABLE IF NOT EXISTS corp_challenges (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES corp_users(id),
 user_version INTEGER NOT NULL, purpose TEXT NOT NULL CHECK(purpose IN ('invite','recover')),
 expires_at INTEGER NOT NULL, email_at INTEGER, code_hash TEXT, code_expires INTEGER,
 attempts INTEGER NOT NULL DEFAULT 0, consumed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS corp_limits (
 key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS corp_audit (
 id TEXT PRIMARY KEY, actor_id TEXT, subject_id TEXT, action TEXT NOT NULL,
 at INTEGER NOT NULL
);
