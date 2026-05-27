-- Optimistic-lock token for InventoryBatch. Every mutation includes the
-- snapshotted version in its WHERE clause and increments the column; a
-- concurrent writer that staged its update from a stale snapshot will fail
-- the predicate match and the caller can retry.
ALTER TABLE "InventoryBatch"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
