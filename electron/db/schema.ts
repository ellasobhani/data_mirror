export const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS records (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    platform         TEXT NOT NULL,
    category         TEXT NOT NULL,
    timestamp        INTEGER NOT NULL,
    title            TEXT,
    body             TEXT,
    url              TEXT,
    metadata         TEXT NOT NULL DEFAULT '{}',
    entities_people  TEXT,
    entities_places  TEXT,
    entities_topics  TEXT,
    summary          TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_records_platform   ON records(platform);
  CREATE INDEX IF NOT EXISTS idx_records_category   ON records(category);
  CREATE INDEX IF NOT EXISTS idx_records_timestamp  ON records(timestamp);
  CREATE INDEX IF NOT EXISTS idx_records_plat_cat   ON records(platform, category);

  CREATE TABLE IF NOT EXISTS platform_status (
    platform      TEXT PRIMARY KEY,
    status        TEXT NOT NULL DEFAULT 'idle',
    requested_at  INTEGER,
    ready_at      INTEGER,
    record_count  INTEGER DEFAULT 0,
    error         TEXT
  );

  CREATE TABLE IF NOT EXISTS ai_summaries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    platform      TEXT,
    category      TEXT,
    period_start  INTEGER,
    period_end    INTEGER,
    summary       TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lens_results (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    lens_id      TEXT NOT NULL UNIQUE,
    result       TEXT NOT NULL,
    lens_quality INTEGER,
    created_at   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reclaim_actions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    platform     TEXT NOT NULL,
    action_type  TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    submitted_at INTEGER,
    confirmed_at INTEGER,
    notes        TEXT
  );
`

// Run after CREATE_TABLES to add columns/tables that didn't exist in earlier versions
export const MIGRATIONS = [
  // v1: add lens_quality rating column
  `ALTER TABLE lens_results ADD COLUMN lens_quality INTEGER`,
]
