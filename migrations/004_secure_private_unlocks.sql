-- Bind private-audio access to the authenticated wallet address and prevent
-- reuse of an on-chain payment across accounts or stories.
ALTER TABLE private_unlocks ADD COLUMN IF NOT EXISTS buyer_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_private_unlock_buyer
  ON private_unlocks(story_id, buyer_id)
  WHERE buyer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_private_unlock_tx
  ON private_unlocks(tx_sig);
