-- Extend fulfillment states for rider-owned delivery workflow.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'RIDER_ASSIGNED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PICKED_UP';

-- Store native push tokens per rider device so available riders can be
-- notified even when the rider app is backgrounded or closed.
CREATE TABLE "RiderDevice" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "platform" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiderDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RiderDevice_pushToken_key" ON "RiderDevice"("pushToken");
CREATE INDEX "RiderDevice_riderId_idx" ON "RiderDevice"("riderId");
CREATE INDEX "RiderDevice_isActive_idx" ON "RiderDevice"("isActive");
CREATE INDEX "Rider_status_idx" ON "Rider"("status");
CREATE INDEX "Order_riderId_idx" ON "Order"("riderId");
CREATE INDEX "Order_riderId_status_idx" ON "Order"("riderId", "status");

ALTER TABLE "RiderDevice"
ADD CONSTRAINT "RiderDevice_riderId_fkey"
FOREIGN KEY ("riderId") REFERENCES "Rider"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
