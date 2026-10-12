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
