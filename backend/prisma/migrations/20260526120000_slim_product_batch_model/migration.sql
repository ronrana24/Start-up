-- ProductCategory enum
CREATE TYPE "ProductCategory" AS ENUM (
  'TISSUE_AND_HYGIENE',
  'PARTY_AND_CELEBRATION',
  'CLEANING_AND_FRAGRANCE',
  'FOOD_ITEMS_AND_CONDIMENTS',
  'TABLEWARE',
  'PACKAGING_AND_CARRY_BAGS'
);

-- Drop the inventory aggregate — each batch now tracks its own quantity.
DROP TABLE IF EXISTS "Inventory";

-- Drop the now-obsolete category index before changing the column type.
DROP INDEX IF EXISTS "Product_category_idx";

-- Map free-text categories to the new enum. The web admin already stored values
-- using the human labels from the ProductCategory TS enum; map each label to
-- its enum key. Any unknown legacy value falls back to TISSUE_AND_HYGIENE.
ALTER TABLE "Product"
  ALTER COLUMN "category" TYPE "ProductCategory"
  USING (
    CASE
      WHEN "category" IN ('Tissue & Hygiene', 'TISSUE_AND_HYGIENE') THEN 'TISSUE_AND_HYGIENE'
      WHEN "category" IN ('Party & Celebration', 'PARTY_AND_CELEBRATION') THEN 'PARTY_AND_CELEBRATION'
      WHEN "category" IN ('Cleaning & Fragrance', 'CLEANING_AND_FRAGRANCE') THEN 'CLEANING_AND_FRAGRANCE'
      WHEN "category" IN ('Food Items & Condiments', 'FOOD_ITEMS_AND_CONDIMENTS') THEN 'FOOD_ITEMS_AND_CONDIMENTS'
      WHEN "category" IN ('Tableware', 'TABLEWARE') THEN 'TABLEWARE'
      WHEN "category" IN ('Packaging & Carry Bags', 'PACKAGING_AND_CARRY_BAGS') THEN 'PACKAGING_AND_CARRY_BAGS'
      ELSE 'TISSUE_AND_HYGIENE'
    END
  )::"ProductCategory";

CREATE INDEX "Product_category_idx" ON "Product" ("category");

-- Pricing has moved to InventoryBatch — drop product-level pricing fields.
ALTER TABLE "Product" DROP COLUMN IF EXISTS "basePrice";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "bulkPricingTiers";

-- Backfill batch tiers from the legacy column before renaming, falling back to
-- a single `{minimumQuantity:1, pricePerUnit:sellingPrice}` tier so every batch
-- ends up with at least one tier (the new schema requires one).
UPDATE "InventoryBatch"
SET "bulkPricingTiers" = jsonb_build_array(
  jsonb_build_object('minimumQuantity', 1, 'pricePerUnit', "sellingPrice")
)
WHERE "bulkPricingTiers" IS NULL
   OR "bulkPricingTiers" = '[]'::jsonb
   OR jsonb_array_length("bulkPricingTiers") = 0;

-- Normalize existing `{minQty, price}` shape into the new `{minimumQuantity, pricePerUnit}` shape.
UPDATE "InventoryBatch"
SET "bulkPricingTiers" = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'minimumQuantity', COALESCE((tier->>'minimumQuantity')::int, (tier->>'minQty')::int),
      'pricePerUnit', COALESCE((tier->>'pricePerUnit')::numeric, (tier->>'price')::numeric)
    )
  )
  FROM jsonb_array_elements("bulkPricingTiers") AS tier
)
WHERE jsonb_typeof("bulkPricingTiers") = 'array'
  AND jsonb_array_length("bulkPricingTiers") > 0;

-- Collapse the four qty columns into a single `quantity` field. The remaining
-- in-flight reservations stay decremented (existing orders are unaffected).
ALTER TABLE "InventoryBatch" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 0;
UPDATE "InventoryBatch" SET "quantity" = "remainingQty";
ALTER TABLE "InventoryBatch" ALTER COLUMN "quantity" DROP DEFAULT;

ALTER TABLE "InventoryBatch" DROP COLUMN "initialQty";
ALTER TABLE "InventoryBatch" DROP COLUMN "remainingQty";
ALTER TABLE "InventoryBatch" DROP COLUMN "reservedQty";
ALTER TABLE "InventoryBatch" DROP COLUMN "consumedQty";
ALTER TABLE "InventoryBatch" DROP COLUMN "warehouseId";
ALTER TABLE "InventoryBatch" DROP COLUMN "isActive";
ALTER TABLE "InventoryBatch" DROP COLUMN "note";

-- Rename the JSON column to its new name.
ALTER TABLE "InventoryBatch" RENAME COLUMN "bulkPricingTiers" TO "bulkTiers";

-- Reindex per the new schema: FIFO ordering relies on (productId, batchNumber).
DROP INDEX IF EXISTS "InventoryBatch_productId_createdAt_idx";
DROP INDEX IF EXISTS "InventoryBatch_warehouseId_idx";
DROP INDEX IF EXISTS "InventoryBatch_isActive_idx";
CREATE INDEX IF NOT EXISTS "InventoryBatch_productId_batchNumber_idx"
  ON "InventoryBatch" ("productId", "batchNumber");
