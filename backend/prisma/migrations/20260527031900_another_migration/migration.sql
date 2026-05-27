-- DropForeignKey
ALTER TABLE "public"."OrderItemBatchAllocation" DROP CONSTRAINT "OrderItemBatchAllocation_batchId_fkey";

-- AlterTable
ALTER TABLE "public"."InventoryBatch" ALTER COLUMN "bulkTiers" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "public"."OrderItemBatchAllocation" ADD CONSTRAINT "OrderItemBatchAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."InventoryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
