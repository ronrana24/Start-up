-- AlterTable
ALTER TABLE "public"."Rider" ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Rider_isAvailable_idx" ON "public"."Rider"("isAvailable");
