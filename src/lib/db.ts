import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "app.db");

function openDb(): Database.Database {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id            TEXT PRIMARY KEY,
      source        TEXT NOT NULL,
      author_handle TEXT NOT NULL,
      author_url    TEXT,
      body          TEXT NOT NULL,
      permalink     TEXT,
      created_at    TEXT NOT NULL,
      raw_json      TEXT
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id                  TEXT PRIMARY KEY,
      post_id             TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      relevance_score     INTEGER NOT NULL,
      relevance_rationale TEXT NOT NULL,
      topic_tags          TEXT NOT NULL,  -- JSON array
      draft_comment       TEXT,
      mentions_sonia      INTEGER NOT NULL DEFAULT 0, -- 0/1
      safety_flags        TEXT NOT NULL,  -- JSON array
      blocked_reason      TEXT,
      model               TEXT NOT NULL,
      created_at          TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS drafts_post_id_idx ON drafts(post_id);

    CREATE TABLE IF NOT EXISTS decisions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      draft_id        TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
      action          TEXT NOT NULL CHECK (action IN ('approve','edit','reject','unsafe')),
      edited_comment  TEXT,
      reviewer_note   TEXT,
      decided_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS decisions_draft_id_idx ON decisions(draft_id);
  `);
}

// Singleton across Next.js hot reloads in dev (avoids "database is locked" / leaked handles).
declare global {
  // eslint-disable-next-line no-var
  var __soniaDb: Database.Database | undefined;
}

export const db: Database.Database = globalThis.__soniaDb ?? openDb();
if (process.env.NODE_ENV !== "production") {
  globalThis.__soniaDb = db;
}

export const DB_FILE_PATH = DB_PATH;
