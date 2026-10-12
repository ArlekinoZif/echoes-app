-- Weekly pool ballots. One ballot per voter per pool; the unique index is what
-- enforces it, so a racing second vote is rejected by the database rather than
-- overwriting the first.
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
