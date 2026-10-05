-- Remove the Impact result level from the results framework.
--
-- The MEAL Plan prints 80 indicator rows; the five Impact-level rows
-- (LS-001, LS-002, EDC-001, EDC-002, EDC-003, under the categories
-- "Improved Living Standards" and "Economic Development and Competitiveness")
-- are out of scope for this platform and are no longer collected.
--
-- This deletes the rows and every value recorded against them. Submission
-- counters are recomputed afterwards so no return is left claiming a
-- completeness percentage that was calculated over 80 indicators.
--
-- Ordering matters: submission_values.indicatorId and .indicatorVersionId are
-- ON DELETE RESTRICT, so the values go first; indicator_versions then cascade
-- from the indicators.

-- 1. Values recorded against Impact-level indicators.
DELETE FROM "submission_values" v
USING "indicators" i, "sectors" s
WHERE v."indicatorId" = i."id"
  AND i."sectorId" = s."id"
  AND s."resultLevel" = 'IMPACT';

-- 2. The indicators themselves (indicator_versions cascade).
DELETE FROM "indicators" i
USING "sectors" s
WHERE i."sectorId" = s."id"
  AND s."resultLevel" = 'IMPACT';

-- 3. The two Impact categories.
DELETE FROM "sectors" WHERE "resultLevel" = 'IMPACT';

-- 4. Recompute the per-submission counters over the surviving indicators.
--    expectedCount mirrors the application's own definition: active and
--    required. A missing value is not zero, so reportedCount counts only
--    values whose validationStatus is REPORTED.
WITH expected AS (
  SELECT count(*)::int AS n FROM "indicators" WHERE "active" AND "required"
),
tally AS (
  SELECT
    s."id" AS submission_id,
    count(*) FILTER (
      WHERE i."id" IS NOT NULL AND v."validationStatus" = 'REPORTED'
    )::int AS reported,
    count(*) FILTER (
      WHERE i."id" IS NOT NULL
        AND v."validationStatus" IN ('REPORTED', 'NOT_APPLICABLE')
    )::int AS answered
  FROM "submissions" s
  LEFT JOIN "submission_values" v ON v."submissionId" = s."id"
  LEFT JOIN "indicators" i ON i."id" = v."indicatorId" AND i."active"
  GROUP BY s."id"
)
UPDATE "submissions" sub
SET "expectedCount"  = expected.n,
    "reportedCount"  = tally.reported,
    "completenessPct" = CASE
      WHEN expected.n = 0 THEN 0
      ELSE round((tally.answered::numeric / expected.n) * 100, 2)
    END
FROM tally, expected
WHERE tally.submission_id = sub."id";

-- 5. Drop IMPACT from the enum. Postgres cannot remove a value in place, so
--    the type is rebuilt and the one column that uses it is re-typed.
ALTER TYPE "ResultLevel" RENAME TO "ResultLevel_old";

CREATE TYPE "ResultLevel" AS ENUM ('OUTCOME', 'SECTORIAL_PRIORITY', 'STRATEGIC_PRIORITY');

ALTER TABLE "sectors"
  ALTER COLUMN "resultLevel" TYPE "ResultLevel"
  USING ("resultLevel"::text::"ResultLevel");

DROP TYPE "ResultLevel_old";
