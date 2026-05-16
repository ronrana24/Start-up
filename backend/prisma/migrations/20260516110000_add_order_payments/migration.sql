-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('UPI', 'PARTIAL_UPI', 'LEGACY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'PARTIALLY_PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'COLLECTED', 'WAIVED');

-- CreateEnum
CREATE TYPE "CollectionMethod" AS ENUM ('CASH', 'UPI_AT_DELIVERY');

-- AlterTable
ALTER TABLE "Order"
  ADD COLUMN "paymentMode" "PaymentMode" NOT NULL DEFAULT 'UPI',
  ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "dueAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "paymentCollectionRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "collectionStatus" "CollectionStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "collectionMethod" "CollectionMethod",
  ADD COLUMN "collectionInstructions" TEXT;

-- Backfill existing historical orders as legacy paid so old data remains usable.
UPDATE "Order"
SET
  "paymentMode" = 'LEGACY',
  "paymentStatus" = 'PAID',
  "paidAmount" = "totalAmount",
  "dueAmount" = 0,
  "paymentCollectionRequired" = false,
  "collectionStatus" = 'NOT_REQUIRED'
WHERE "createdAt" < NOW();

-- CreateTable
CREATE TABLE "PaymentTransaction" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'razorpay',
  "razorpayOrderId" TEXT,
  "razorpayPaymentId" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "errorCode" TEXT,
  "errorDescription" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'razorpay',
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAudit" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "amount" DECIMAL(12,2),
  "previousStatus" TEXT,
  "nextStatus" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderPaymentCollection" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "riderId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "method" "CollectionMethod" NOT NULL,
  "reference" TEXT,
  "note" TEXT,
  "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RiderPaymentCollection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_razorpayOrderId_key" ON "PaymentTransaction"("razorpayOrderId");
CREATE UNIQUE INDEX "PaymentTransaction_razorpayPaymentId_key" ON "PaymentTransaction"("razorpayPaymentId");
CREATE UNIQUE INDEX "PaymentTransaction_idempotencyKey_key" ON "PaymentTransaction"("idempotencyKey");
CREATE UNIQUE INDEX "PaymentWebhookEvent_eventId_key" ON "PaymentWebhookEvent"("eventId");
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");
CREATE INDEX "Order_paymentCollectionRequired_collectionStatus_idx" ON "Order"("paymentCollectionRequired", "collectionStatus");
CREATE INDEX "PaymentTransaction_orderId_idx" ON "PaymentTransaction"("orderId");
CREATE INDEX "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");
CREATE INDEX "PaymentTransaction_createdAt_idx" ON "PaymentTransaction"("createdAt");
CREATE INDEX "PaymentWebhookEvent_eventType_idx" ON "PaymentWebhookEvent"("eventType");
CREATE INDEX "PaymentWebhookEvent_createdAt_idx" ON "PaymentWebhookEvent"("createdAt");
CREATE INDEX "PaymentAudit_orderId_idx" ON "PaymentAudit"("orderId");
CREATE INDEX "PaymentAudit_eventType_idx" ON "PaymentAudit"("eventType");
CREATE INDEX "PaymentAudit_createdAt_idx" ON "PaymentAudit"("createdAt");
CREATE INDEX "RiderPaymentCollection_orderId_idx" ON "RiderPaymentCollection"("orderId");
CREATE INDEX "RiderPaymentCollection_riderId_idx" ON "RiderPaymentCollection"("riderId");
CREATE INDEX "RiderPaymentCollection_collectedAt_idx" ON "RiderPaymentCollection"("collectedAt");

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAudit" ADD CONSTRAINT "PaymentAudit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiderPaymentCollection" ADD CONSTRAINT "RiderPaymentCollection_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiderPaymentCollection" ADD CONSTRAINT "RiderPaymentCollection_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PaymentAudit" ("id", "orderId", "eventType", "message", "amount", "nextStatus", "metadata", "createdAt")
SELECT
  concat('legacy_', "id"),
  "id",
  'LEGACY_BACKFILL',
  'Existing order marked as paid during payment schema migration.',
  "totalAmount",
  'PAID',
  '{"source":"migration"}'::jsonb,
  NOW()
FROM "Order";
