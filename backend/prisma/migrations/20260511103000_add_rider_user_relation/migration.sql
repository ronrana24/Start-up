-- Link rider operational profiles to their auth user identity.
-- Existing standalone riders are backfilled with RIDER users so the FK can be
-- enforced without dropping delivery history.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Rider" r
    JOIN "User" u ON u."phone" = r."phone"
    WHERE u."role" <> 'RIDER'
  ) THEN
    RAISE EXCEPTION 'Cannot link Rider to User: a rider phone is already used by a non-RIDER user';
  END IF;
END $$;

INSERT INTO "User" (
  "id",
  "phone",
  "email",
  "name",
  "googleId",
  "businessName",
  "businessType",
  "gstNumber",
  "isOnboardingCompleted",
  "role",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy_rider_' || substr(md5(r."phone"), 1, 24),
  r."phone",
  NULL,
  r."name",
  NULL,
  r."name",
  'OTHER',
  NULL,
  true,
  'RIDER',
  r."createdAt",
  r."updatedAt"
FROM "Rider" r
LEFT JOIN "User" u ON u."phone" = r."phone"
WHERE u."id" IS NULL;

ALTER TABLE "Rider" ADD COLUMN "userId" TEXT;

UPDATE "Rider" r
SET "userId" = u."id"
FROM "User" u
WHERE u."phone" = r."phone"
  AND u."role" = 'RIDER';

ALTER TABLE "Rider" ALTER COLUMN "userId" SET NOT NULL;

CREATE UNIQUE INDEX "Rider_userId_key" ON "Rider"("userId");
CREATE INDEX "Rider_userId_idx" ON "Rider"("userId");

ALTER TABLE "Rider"
ADD CONSTRAINT "Rider_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
