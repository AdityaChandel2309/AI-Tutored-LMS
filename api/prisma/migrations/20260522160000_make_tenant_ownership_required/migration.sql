INSERT INTO "Tenant" ("id", "name", "subdomain", "createdAt")
SELECT
  '00000000-0000-0000-0000-000000000001',
  'Default LMS',
  'default',
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "Tenant"
  WHERE "subdomain" = 'default'
);

UPDATE "Tenant"
SET "subdomain" = CONCAT(
  'tenant-',
  SUBSTRING(REPLACE("id", '-', '') FROM 1 FOR 8)
)
WHERE "subdomain" IS NULL;

UPDATE "User"
SET "tenantId" = (
  SELECT "id"
  FROM "Tenant"
  WHERE "subdomain" = 'default'
  ORDER BY "createdAt" ASC
  LIMIT 1
)
WHERE "tenantId" IS NULL;

ALTER TABLE "Tenant"
ALTER COLUMN "subdomain" SET NOT NULL;

ALTER TABLE "User"
ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "User" DROP CONSTRAINT "User_tenantId_fkey";

ALTER TABLE "User"
ADD CONSTRAINT "User_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
