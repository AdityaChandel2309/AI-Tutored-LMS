-- Add an explicit ordering column to Lesson so lesson sequence is deterministic.

-- 1) Add the column with a temporary default so existing rows are valid.
ALTER TABLE "Lesson" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- 2) Backfill a stable per-module order from existing creation order.
--    Existing data may have multiple lessons per module all at order 0,
--    which would violate the unique index below, so assign 1..N per module.
WITH ordered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "moduleId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS rn
  FROM "Lesson"
)
UPDATE "Lesson" AS l
SET "order" = ordered.rn
FROM ordered
WHERE l."id" = ordered."id";

-- 3) Enforce uniqueness of (moduleId, order) going forward.
CREATE UNIQUE INDEX "Lesson_moduleId_order_key" ON "Lesson"("moduleId", "order");
