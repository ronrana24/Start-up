-- Replace legacy BusinessType values with expanded wholesale categories.

CREATE TYPE "public"."BusinessType_new" AS ENUM (
  'FOOD_AND_BEVERAGE',
  'HEALTHCARE_AND_MEDICAL',
  'HOSPITALITY_AND_SERVICES',
  'RETAIL_AND_ECOMMERCE',
  'OTHER'
);

ALTER TABLE "public"."User" ALTER COLUMN "businessType" DROP DEFAULT;

ALTER TABLE "public"."User" ALTER COLUMN "businessType" TYPE "public"."BusinessType_new" USING (
  CASE "businessType"::text
    WHEN 'RESTAURANT' THEN 'FOOD_AND_BEVERAGE'::"public"."BusinessType_new"
    WHEN 'EVENT_PLANNER' THEN 'HOSPITALITY_AND_SERVICES'::"public"."BusinessType_new"
    WHEN 'OTHER' THEN 'OTHER'::"public"."BusinessType_new"
    ELSE 'OTHER'::"public"."BusinessType_new"
  END
);

ALTER TABLE "public"."User" ALTER COLUMN "businessType" SET DEFAULT 'OTHER'::"public"."BusinessType_new";

DROP TYPE "public"."BusinessType";

ALTER TYPE "public"."BusinessType_new" RENAME TO "BusinessType";
