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
