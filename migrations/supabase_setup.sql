-- Echoes · Supabase Schema
-- Run at: https://supabase.com/dashboard/project/htpxzfesrtripvawpugc/sql/new

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  duration_secs INTEGER NOT NULL DEFAULT 0,
  publish_gate TEXT NOT NULL DEFAULT 'evaluate',
  status TEXT NOT NULL DEFAULT 'draft',
  owner_id TEXT,
  author_wallet TEXT,
  cover_image_url TEXT,
  author_twitter TEXT,
  listing_tx_sig TEXT,
  ticker TEXT,
  token_mint TEXT,
  token_listing_url TEXT,
  launch_type TEXT,
  sponsor_wallet TEXT,
  arweave_cid TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  price_sol NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluations (
  id BIGSERIAL PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  evaluator_wallet TEXT NOT NULL,
  audio_quality INTEGER NOT NULL,
  storytelling INTEGER NOT NULL,
  description_accuracy INTEGER NOT NULL,
  listened_percent NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(story_id, evaluator_wallet)
);

CREATE TABLE IF NOT EXISTS favourites (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wallet, story_id)
);

CREATE TABLE IF NOT EXISTS user_profiles (
  wallet TEXT PRIMARY KEY,
  age INTEGER,
  gender TEXT,
  status TEXT,
  country TEXT,
  languages TEXT,
  goals TEXT,
  email TEXT,
  twitter TEXT,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  referral_split NUMERIC NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS private_unlocks (
  id BIGSERIAL PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  tx_sig TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(story_id, buyer_id),
  UNIQUE(tx_sig)
);

CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);
CREATE INDEX IF NOT EXISTS idx_stories_author ON stories(author_wallet);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stories_listing_tx ON stories(listing_tx_sig) WHERE listing_tx_sig IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evals_story ON evaluations(story_id);
CREATE INDEX IF NOT EXISTS idx_evals_evaluator ON evaluations(evaluator_wallet);
CREATE INDEX IF NOT EXISTS idx_favs_wallet ON favourites(wallet);

-- The application accesses these tables only through authenticated server API
-- routes using the service-role key. No browser/anon table access is allowed.
CREATE TABLE IF NOT EXISTS pool_ballots (
  id BIGSERIAL PRIMARY KEY,
  pool_id INTEGER NOT NULL,
  voter TEXT NOT NULL,
  commitment TEXT NOT NULL,
  echoes_amount NUMERIC NOT NULL DEFAULT 0,
  revealed BOOLEAN NOT NULL DEFAULT FALSE,
  story_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_ballot_voter ON pool_ballots(pool_id, voter);
CREATE INDEX IF NOT EXISTS idx_pool_ballot_pool ON pool_ballots(pool_id);

ALTER TABLE pool_ballots ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS content_reports (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_story_reporter ON content_reports(story_id, reporter_id);
CREATE INDEX IF NOT EXISTS idx_report_status ON content_reports(status, created_at DESC);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_unlocks ENABLE ROW LEVEL SECURITY;
