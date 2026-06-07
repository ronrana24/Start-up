/*
  Warnings:

  - The values [TABLEWARE] on the enum `ProductCategory` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."ProductCategory_new" AS ENUM ('TISSUE_AND_HYGIENE', 'PARTY_AND_CELEBRATION', 'CLEANING_AND_FRAGRANCE', 'FOOD_ITEMS_AND_CONDIMENTS', 'FOOD_CONTAINERS', 'FORK_AND_SPOON', 'PACKAGING_AND_CARRY_BAGS', 'PLATE', 'CUP');
ALTER TABLE "public"."Product" ALTER COLUMN "category" TYPE "public"."ProductCategory_new" USING ("category"::text::"public"."ProductCategory_new");
ALTER TYPE "public"."ProductCategory" RENAME TO "ProductCategory_old";
ALTER TYPE "public"."ProductCategory_new" RENAME TO "ProductCategory";
DROP TYPE "public"."ProductCategory_old";
COMMIT;
