-- Echoes · add stable owner identity to stories
-- Run at: https://supabase.com/dashboard/project/htpxzfesrtripvawpugc/sql/new
--
-- `owner_id` holds the canonical Solana wallet address established by the
-- wallet-signed Echoes session. `author_wallet` remains the payout wallet.

ALTER TABLE stories ADD COLUMN IF NOT EXISTS owner_id TEXT;

CREATE INDEX IF NOT EXISTS idx_stories_owner ON stories(owner_id);
