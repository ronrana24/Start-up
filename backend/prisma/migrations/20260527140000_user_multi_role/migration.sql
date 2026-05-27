-- Add roles array column, populate from existing role, then drop the single role column

ALTER TABLE "User" ADD COLUMN "roles" "UserRole"[] NOT NULL DEFAULT ARRAY['BUYER'::"UserRole"];

-- Copy each user's existing single role into the new array
UPDATE "User" SET "roles" = ARRAY["role"::"UserRole"];

-- Drop the old single-value column
ALTER TABLE "User" DROP COLUMN "role";
