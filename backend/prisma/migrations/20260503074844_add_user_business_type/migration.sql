-- CreateEnum
CREATE TYPE "public"."BusinessType" AS ENUM ('RESTAURANT', 'EVENT_PLANNER', 'OTHER');

-- AlterEnum
ALTER TYPE "public"."UserRole" ADD VALUE 'RIDER';

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "businessType" "public"."BusinessType" NOT NULL DEFAULT 'OTHER';
