CREATE TYPE "PricingDiscountType" AS ENUM ('PERCENT_OFF', 'AMOUNT_OFF');

CREATE TYPE "PricingRuleAuditAction" AS ENUM ('CREATED', 'UPDATED', 'DISABLED', 'ENABLED');

ALTER TABLE "OrderItem" ADD COLUMN "pricingSnapshot" JSONB;

CREATE TABLE "UserProductPricingRule" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "discountType" "PricingDiscountType" NOT NULL,
  "discountValue" DECIMAL(12,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "adminNote" TEXT,
  "createdByAdminId" TEXT,
  "updatedByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserProductPricingRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserProductPricingAudit" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "changedByAdminId" TEXT,
  "action" "PricingRuleAuditAction" NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserProductPricingAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserProductPricingRule_userId_productId_key" ON "UserProductPricingRule"("userId", "productId");
CREATE INDEX "UserProductPricingRule_productId_idx" ON "UserProductPricingRule"("productId");
CREATE INDEX "UserProductPricingRule_isActive_idx" ON "UserProductPricingRule"("isActive");
CREATE INDEX "UserProductPricingRule_createdByAdminId_idx" ON "UserProductPricingRule"("createdByAdminId");
CREATE INDEX "UserProductPricingRule_updatedByAdminId_idx" ON "UserProductPricingRule"("updatedByAdminId");
CREATE INDEX "UserProductPricingAudit_ruleId_idx" ON "UserProductPricingAudit"("ruleId");
CREATE INDEX "UserProductPricingAudit_userId_idx" ON "UserProductPricingAudit"("userId");
CREATE INDEX "UserProductPricingAudit_productId_idx" ON "UserProductPricingAudit"("productId");
CREATE INDEX "UserProductPricingAudit_changedByAdminId_idx" ON "UserProductPricingAudit"("changedByAdminId");
CREATE INDEX "UserProductPricingAudit_createdAt_idx" ON "UserProductPricingAudit"("createdAt");

ALTER TABLE "UserProductPricingRule" ADD CONSTRAINT "UserProductPricingRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProductPricingRule" ADD CONSTRAINT "UserProductPricingRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProductPricingRule" ADD CONSTRAINT "UserProductPricingRule_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserProductPricingRule" ADD CONSTRAINT "UserProductPricingRule_updatedByAdminId_fkey" FOREIGN KEY ("updatedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserProductPricingAudit" ADD CONSTRAINT "UserProductPricingAudit_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "UserProductPricingRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProductPricingAudit" ADD CONSTRAINT "UserProductPricingAudit_changedByAdminId_fkey" FOREIGN KEY ("changedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
