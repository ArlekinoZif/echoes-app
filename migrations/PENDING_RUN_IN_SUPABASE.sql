-- Echoes: all pending migrations for production, in order.
-- Safe to run more than once (every statement is IF NOT EXISTS).
-- Paste into Supabase → SQL editor → Run.
BEGIN;

-- ── 004_secure_private_unlocks.sql ─────────────────────────────
-- Bind private-audio access to the authenticated wallet address and prevent
-- reuse of an on-chain payment across accounts or stories.
ALTER TABLE private_unlocks ADD COLUMN IF NOT EXISTS buyer_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_private_unlock_buyer
  ON private_unlocks(story_id, buyer_id)
  WHERE buyer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_private_unlock_tx
  ON private_unlocks(tx_sig);

-- ── 006_reports.sql ─────────────────────────────
-- Content reports for user-generated stories, required by the Solana dApp Store
-- publisher policy. One report per story per reporter.
CREATE TABLE IF NOT EXISTS content_reports (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_story_reporter
  ON content_reports(story_id, reporter_id);
CREATE INDEX IF NOT EXISTS idx_report_status ON content_reports(status, created_at DESC);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

-- ── 007_app_sessions.sql ─────────────────────────────
-- Signed-in devices for the native app, and verified Seeker owners.
--
-- app_sessions: one row per sign-in from the Android app. The session cookie
-- carries the row id; revoking the row signs that device out on its next request.
-- The website's sessions are not recorded here.
CREATE TABLE IF NOT EXISTS app_sessions (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  device_name TEXT,
  platform TEXT,
  is_seeker BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_wallet
  ON app_sessions(wallet, last_seen_at DESC) WHERE revoked_at IS NULL;

ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;

-- seeker_verifications: a wallet proven to hold a Seeker Genesis Token. The SGT
-- mint is unique, so one device's token cannot verify several wallets by being
-- passed between them.
CREATE TABLE IF NOT EXISTS seeker_verifications (
  wallet TEXT PRIMARY KEY,
  sgt_mint TEXT NOT NULL UNIQUE,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE seeker_verifications ENABLE ROW LEVEL SECURITY;

COMMIT;
