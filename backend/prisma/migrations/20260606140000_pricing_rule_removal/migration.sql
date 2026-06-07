-- Add REMOVED action for the final audit entry written before a rule is deleted.
ALTER TYPE "PricingRuleAuditAction" ADD VALUE 'REMOVED';

-- Make the audit -> rule link nullable and switch the FK to SET NULL, so a
-- hard-deleted pricing rule leaves its audit trail intact (the row's ruleId
-- simply nulls out instead of cascade-deleting the history).
ALTER TABLE "UserProductPricingAudit"
  DROP CONSTRAINT "UserProductPricingAudit_ruleId_fkey";

ALTER TABLE "UserProductPricingAudit"
  ALTER COLUMN "ruleId" DROP NOT NULL;

ALTER TABLE "UserProductPricingAudit"
  ADD CONSTRAINT "UserProductPricingAudit_ruleId_fkey"
  FOREIGN KEY ("ruleId") REFERENCES "UserProductPricingRule"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
