-- Reject submissions for a reporting cycle that has not opened yet.
--
-- The application already blocks this in three places (authorizeDataEntry,
-- the workflow transition guard, and ensureSubmission). This trigger is the
-- backstop for everything that does NOT go through the application: seed and
-- migration scripts, a future bulk-import tool, or a hand-run psql statement.
--
-- The rule is deliberately "the cycle has OPENED" (opensAt <= now), not "the
-- cycle is currently OPEN". Review, approval and publication legitimately
-- happen after a reporting window closes, and must not be blocked.

CREATE OR REPLACE FUNCTION stisa_reject_unopened_cycle()
RETURNS TRIGGER AS $$
DECLARE
  cycle_opens_at TIMESTAMP(3);
  cycle_year     INTEGER;
BEGIN
  SELECT "opensAt", "reportingYear"
    INTO cycle_opens_at, cycle_year
    FROM reporting_cycles
   WHERE id = NEW."reportingCycleId";

  IF cycle_opens_at IS NULL THEN
    RAISE EXCEPTION 'Reporting cycle % does not exist.', NEW."reportingCycleId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF cycle_opens_at > now() THEN
    RAISE EXCEPTION
      'Cannot create a submission for the % reporting cycle: it does not open until %. Adjust the cycle window in /admin/reporting-cycles if this is intentional.',
      cycle_year, to_char(cycle_opens_at, 'DD Mon YYYY')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS submissions_reject_unopened_cycle ON submissions;

CREATE TRIGGER submissions_reject_unopened_cycle
  BEFORE INSERT OR UPDATE OF "reportingCycleId" ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION stisa_reject_unopened_cycle();
