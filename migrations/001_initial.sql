-- Echoes · Cloudflare D1 schema
-- Run: wrangler d1 execute echoes-db --file=migrations/001_initial.sql

CREATE TABLE IF NOT EXISTS stories (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL,
  audio_url         TEXT NOT NULL,
  duration_secs     INTEGER NOT NULL DEFAULT 0,
  publish_gate      TEXT NOT NULL DEFAULT 'evaluate',
  status            TEXT NOT NULL DEFAULT 'draft',
  author_wallet     TEXT,
  cover_image_url   TEXT,
  author_twitter    TEXT,
  listing_tx_sig    TEXT,
  ticker            TEXT,
  token_mint        TEXT,
  token_listing_url TEXT,
  launch_type       TEXT,
  sponsor_wallet    TEXT,
  arweave_cid       TEXT,
  is_private        INTEGER NOT NULL DEFAULT 0,  -- 1 = paid access only
  price_sol         REAL,                         -- unlock price if private
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS evaluations (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id          TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  evaluator_wallet  TEXT NOT NULL,
  audio_quality     INTEGER NOT NULL,
  storytelling      INTEGER NOT NULL,
  description_accuracy INTEGER NOT NULL,
  listened_percent  REAL NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(story_id, evaluator_wallet)
);

CREATE TABLE IF NOT EXISTS favourites (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet    TEXT NOT NULL,
  story_id  TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(wallet, story_id)
);

CREATE TABLE IF NOT EXISTS user_profiles (
  wallet      TEXT PRIMARY KEY,
  age         INTEGER,
  gender      TEXT,
  status      TEXT,
  country     TEXT,
  languages   TEXT,   -- comma-separated
  goals       TEXT,   -- JSON array: ["tell","listen",...]
  email       TEXT,
  twitter     TEXT,
  referral_code TEXT UNIQUE,
  referred_by   TEXT,
  referral_split REAL NOT NULL DEFAULT 0.5,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS private_unlocks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id    TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  wallet      TEXT NOT NULL,
  tx_sig      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(story_id, wallet)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stories_status   ON stories(status);
CREATE INDEX IF NOT EXISTS idx_stories_author   ON stories(author_wallet);
CREATE INDEX IF NOT EXISTS idx_evals_story      ON evaluations(story_id);
CREATE INDEX IF NOT EXISTS idx_evals_evaluator  ON evaluations(evaluator_wallet);
CREATE INDEX IF NOT EXISTS idx_favs_wallet      ON favourites(wallet);
CREATE INDEX IF NOT EXISTS idx_unlocks_wallet   ON private_unlocks(wallet);
