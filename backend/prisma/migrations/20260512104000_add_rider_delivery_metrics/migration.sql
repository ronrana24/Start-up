-- Rider order-history metrics. Nullable for backward compatibility with existing orders.
ALTER TABLE "Order"
ADD COLUMN "pickedUpAt" TIMESTAMP(3),
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "deliveryDistanceKm" DECIMAL(8, 2);

CREATE INDEX "Order_riderId_status_updatedAt_idx" ON "Order"("riderId", "status", "updatedAt");
