-- AlterTable
ALTER TABLE "InventoryBatch"
  ADD COLUMN "bulkPricingTiers" JSONB NOT NULL DEFAULT '[]';

-- Backfill: seed each existing batch with its product's bulk pricing tiers so
-- legacy bulk discounts continue to apply until admins set batch-specific tiers.
UPDATE "InventoryBatch" b
SET "bulkPricingTiers" = COALESCE(p."bulkPricingTiers", '[]'::jsonb)
FROM "Product" p
WHERE p."id" = b."productId";
