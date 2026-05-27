-- CreateTable
CREATE TABLE "InventoryBatch" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL DEFAULT 'default',
  "batchNumber" INTEGER NOT NULL,
  "costPrice" DECIMAL(12,2) NOT NULL,
  "sellingPrice" DECIMAL(12,2) NOT NULL,
  "initialQty" INTEGER NOT NULL,
  "remainingQty" INTEGER NOT NULL,
  "reservedQty" INTEGER NOT NULL DEFAULT 0,
  "consumedQty" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemBatchAllocation" (
  "id" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrderItemBatchAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBatch_productId_batchNumber_key" ON "InventoryBatch"("productId", "batchNumber");
CREATE INDEX "InventoryBatch_productId_createdAt_idx" ON "InventoryBatch"("productId", "createdAt");
CREATE INDEX "InventoryBatch_warehouseId_idx" ON "InventoryBatch"("warehouseId");
CREATE INDEX "InventoryBatch_isActive_idx" ON "InventoryBatch"("isActive");
CREATE INDEX "OrderItemBatchAllocation_orderItemId_idx" ON "OrderItemBatchAllocation"("orderItemId");
CREATE INDEX "OrderItemBatchAllocation_batchId_idx" ON "OrderItemBatchAllocation"("batchId");

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItemBatchAllocation" ADD CONSTRAINT "OrderItemBatchAllocation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItemBatchAllocation" ADD CONSTRAINT "OrderItemBatchAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON UPDATE CASCADE;

-- Backfill: seed one InventoryBatch per existing Inventory row using the product basePrice
-- so the FIFO consumption logic has at least one batch to allocate from.
-- The seeded batch uses basePrice for both cost and selling so legacy pricing is preserved.
INSERT INTO "InventoryBatch" (
  "id",
  "productId",
  "warehouseId",
  "batchNumber",
  "costPrice",
  "sellingPrice",
  "initialQty",
  "remainingQty",
  "reservedQty",
  "consumedQty",
  "note",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('seed_', i."id"),
  i."productId",
  i."warehouseId",
  1,
  p."basePrice",
  p."basePrice",
  i."availableQty" + i."reservedQty",
  i."availableQty",
  i."reservedQty",
  0,
  'Initial batch backfilled from inventory aggregate.',
  TRUE,
  p."createdAt",
  NOW()
FROM "Inventory" i
JOIN "Product" p ON p."id" = i."productId";
