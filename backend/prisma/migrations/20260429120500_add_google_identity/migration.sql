-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN "email" TEXT;
ALTER TABLE "public"."User" ADD COLUMN "name" TEXT;
ALTER TABLE "public"."User" ADD COLUMN "googleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "public"."User"("googleId");
