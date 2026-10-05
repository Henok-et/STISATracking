/**
 * End-to-end verification of the data rules the platform promises.
 * Run: npm run test:smoke
 *
 * Creates a disposable scenario, walks it through the full workflow, then
 * asserts the invariants that matter:
 *
 *   1. Missing data is never counted as zero.
 *   2. Denominators reflect only what was actually reported.
 *   3. Indicators with no methodology in the source are not scored.
 *   4. Unpublished submissions never reach public analytics.
 *   5. A later reporting cycle never overwrites an earlier one.
 *
 * The scenario is removed afterwards, leaving the database as it was.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { calculateProgress } from '../src/lib/analytics/progress';
import { meanOfValid, completeness } from '../src/lib/analytics/aggregate';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

let failures = 0;
let checks = 0;

function assert(label: string, condition: boolean, detail?: string) {
  checks++;
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/**
 * Only rows this run created are removed.
 *
 * An earlier version of this script pinned itself to Ethiopia and cleaned up
 * with `deleteMany({ where: { countryId } })`. That deleted EVERY submission
 * for that Member State, including real ones the test had not created — a test
 * must never destroy data it did not make.
 */
const created: { submissionIds: string[] } = { submissionIds: [] };

async function cleanup() {
  if (created.submissionIds.length === 0) return;
  await prisma.auditLog.deleteMany({
    where: { submissionId: { in: created.submissionIds } },
  });
  await prisma.submissionValue.deleteMany({
    where: { submissionId: { in: created.submissionIds } },
  });
  await prisma.submission.deleteMany({ where: { id: { in: created.submissionIds } } });
  created.submissionIds = [];
}

/** A Member State with no submissions at all, so the test cannot collide. */
async function pickFreeCountry() {
  const country = await prisma.country.findFirst({
    where: { active: true, submissions: { none: {} } },
    include: { region: true },
    orderBy: { shortName: 'asc' },
  });
  if (!country) {
    throw new Error(
      'Every Member State already has a submission. This test needs one with none, ' +
        'so that it can create and remove its own scenario without touching real data.',
    );
  }
  return country;
}

async function main() {
  console.log('STISA 2034 — end-to-end verification');
  console.log('='.repeat(64));

  const country = await pickFreeCountry();
  const cycle2026 = await prisma.reportingCycle.findUniqueOrThrow({ where: { reportingYear: 2026 } });
  const cycle2028 = await prisma.reportingCycle.findUniqueOrThrow({ where: { reportingYear: 2028 } });

  const indicators = await prisma.indicator.findMany({
    where: { active: true },
    include: { versions: { where: { effectiveTo: null }, take: 1 } },
    orderBy: { sortOrder: 'asc' },
  });
  const requiredCount = indicators.filter((i) => i.required).length;

  // Pick representative indicators.
  const scorable = indicators.find(
    (i) => i.calculationMethod === 'ABSOLUTE_COUNT' && i.dataType === 'INTEGER',
  )!;
  const unscorable = indicators.find((i) => i.calculationMethod === 'UNDEFINED')!;
  const pctChange = indicators.find((i) => i.calculationMethod === 'PERCENTAGE_CHANGE')!;

  console.log(`\nScenario: ${country.shortName} (${country.region.name})`);
  console.log(`  scorable indicator   ${scorable.code}`);
  console.log(`  unscorable indicator ${unscorable.code} (${unscorable.calculationMethod})`);
  console.log(`  change indicator     ${pctChange.code}`);

  // -------------------------------------------------------------------------
  // 1. Build a 2026 submission with a deliberate mix of states
  // -------------------------------------------------------------------------
  console.log('\n[1] Creating a 2026 submission with mixed value states');

  const submission = await prisma.submission.create({
    data: {
      countryId: country.id,
      reportingCycleId: cycle2026.id,
      status: 'DRAFT',
      expectedCount: requiredCount,
    },
  });
  created.submissionIds.push(submission.id);

  const mk = (
    indicator: (typeof indicators)[number],
    data: Record<string, unknown>,
  ) =>
    prisma.submissionValue.create({
      data: {
        submissionId: submission.id,
        indicatorId: indicator.id,
        indicatorVersionId: indicator.versions[0]!.id,
        ...data,
      },
    });

  // Reported: actual halfway between baseline and target -> 50% progress.
  await mk(scorable, {
    dataAvailable: true,
    baselineValue: 100,
    targetValue: 200,
    actualValue: 150,
    validationStatus: 'REPORTED',
    sourceName: 'National Statistics Office',
  });

  // Reported but the source defines no methodology -> must not be scored.
  await mk(unscorable, {
    dataAvailable: true,
    baselineValue: 10,
    targetValue: 50,
    actualValue: 30,
    validationStatus: 'REPORTED',
    sourceName: 'Ministry of Finance',
  });

  // A change measure: reported 4% against a 8% target -> 50%.
  await mk(pctChange, {
    dataAvailable: true,
    targetValue: 8,
    actualValue: 4,
    validationStatus: 'REPORTED',
    sourceName: 'Central Bank',
  });

  // Explicitly not reported — must never behave like a zero.
  const notReported = indicators.filter(
    (i) => ![scorable.id, unscorable.id, pctChange.id].includes(i.id),
  )[0]!;
  await mk(notReported, {
    dataAvailable: false,
    validationStatus: 'NOT_REPORTED',
    notes: 'National statistics for this indicator are not yet collected.',
  });

  // Not applicable — answered, but excluded from progress averages.
  const notApplicable = indicators.filter(
    (i) => ![scorable.id, unscorable.id, pctChange.id, notReported.id].includes(i.id),
  )[0]!;
  await mk(notApplicable, {
    dataAvailable: false,
    validationStatus: 'NOT_APPLICABLE',
    notes: 'Landlocked — this indicator does not apply.',
  });

  console.log('  5 values written (1 scorable, 1 unscorable, 1 change, 1 missing, 1 N/A)');

  // -------------------------------------------------------------------------
  // 2. Calculation engine
  // -------------------------------------------------------------------------
  console.log('\n[2] Calculation engine');

  const p1 = calculateProgress({
    calculationMethod: scorable.calculationMethod,
    direction: scorable.direction,
    dataType: scorable.dataType,
    baseline: 100,
    target: 200,
    actual: 150,
  });
  assert('level indicator halfway to target scores 50%', p1.scored && p1.percent === 50, String(p1.percent));

  const p2 = calculateProgress({
    calculationMethod: unscorable.calculationMethod,
    direction: unscorable.direction,
    dataType: unscorable.dataType,
    baseline: 10,
    target: 50,
    actual: 30,
  });
  assert('indicator with no source methodology is NOT scored', !p2.scored && p2.percent === null);
  assert('unscored indicator explains why', p2.reason === 'NO_METHODOLOGY');

  const p3 = calculateProgress({
    calculationMethod: 'PERCENTAGE_CHANGE',
    direction: 'HIGHER_IS_BETTER',
    dataType: 'PERCENTAGE',
    baseline: null,
    target: 8,
    actual: 4,
  });
  assert('change measure compares against the target change', p3.scored && p3.percent === 50, String(p3.percent));

  // A lower-is-better change measure carries its direction in the sign of the
  // values, so halfway to a target reduction must score 50%, not 0%.
  const p3b = calculateProgress({
    calculationMethod: 'PERCENTAGE_CHANGE',
    direction: 'LOWER_IS_BETTER',
    dataType: 'PERCENTAGE',
    baseline: null,
    target: -20,
    actual: -10,
  });
  assert(
    'lower-is-better change measure halfway to target scores 50%',
    p3b.scored && p3b.percent === 50,
    String(p3b.percent),
  );

  // Moving the wrong way on a reduction target is no progress, not negative.
  const p3c = calculateProgress({
    calculationMethod: 'PERCENTAGE_CHANGE',
    direction: 'LOWER_IS_BETTER',
    dataType: 'PERCENTAGE',
    baseline: null,
    target: -20,
    actual: 5,
  });
  assert(
    'moving away from a reduction target floors at 0%',
    p3c.scored && p3c.percent === 0,
    String(p3c.percent),
  );

  const p4 = calculateProgress({
    calculationMethod: 'ABSOLUTE_COUNT',
    direction: 'HIGHER_IS_BETTER',
    dataType: 'INTEGER',
    baseline: 100,
    target: 200,
    actual: null,
  });
  assert('a missing actual is unscored, not zero', !p4.scored && p4.reason === 'NO_ACTUAL');

  const p5 = calculateProgress({
    calculationMethod: 'ABSOLUTE_COUNT',
    direction: 'LOWER_IS_BETTER',
    dataType: 'INTEGER',
    baseline: 100,
    target: 50,
    actual: 75,
  });
  assert('lower-is-better halfway to target scores 50%', p5.scored && p5.percent === 50, String(p5.percent));

  const p6 = calculateProgress({
    calculationMethod: 'ABSOLUTE_COUNT',
    direction: 'HIGHER_IS_BETTER',
    dataType: 'INTEGER',
    baseline: 100,
    target: 200,
    actual: 80,
  });
  assert('regression floors at 0%, never negative', p6.scored && p6.percent === 0, String(p6.percent));

  const p7 = calculateProgress({
    calculationMethod: 'ABSOLUTE_COUNT',
    direction: 'HIGHER_IS_BETTER',
    dataType: 'INTEGER',
    baseline: 100,
    target: 200,
    actual: 250,
  });
  assert('over-achievement is not capped at 100%', p7.scored && p7.percent === 150, String(p7.percent));

  // -------------------------------------------------------------------------
  // 3. Aggregation — the missing-data rule
  // -------------------------------------------------------------------------
  console.log('\n[3] Aggregation and the missing-data rule');

  const agg = meanOfValid([80, null, 40, undefined, null], { unit: 'countries', expected: 5 });
  assert('nulls are excluded from the mean, not zeroed', agg.value === 60, String(agg.value));
  assert('denominator counts only valid observations', agg.n === 2 && agg.expected === 5);
  assert(
    'basis sentence states the denominator',
    agg.basis ===
      'Average of 2 usable countries, out of 5 expected. The other 3 had no usable number and are left out of both the total and the count, not entered as zero.',
    agg.basis,
  );

  const empty = meanOfValid([null, null], { unit: 'countries' });
  assert('all-missing yields null, not 0', empty.value === null);

  const comp = completeness(3, 80);
  assert('completeness is reported ÷ expected', comp.value === 3.75, String(comp.value));

  // -------------------------------------------------------------------------
  // 4. Public boundary — nothing visible until published
  // -------------------------------------------------------------------------
  console.log('\n[4] Public/private boundary');

  const publicVisible = async () =>
    prisma.submissionValue.count({
      where: { submission: { status: 'PUBLISHED', countryId: country.id } },
    });

  assert('a DRAFT submission is invisible publicly', (await publicVisible()) === 0);

  for (const status of ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] as const) {
    await prisma.submission.update({ where: { id: submission.id }, data: { status } });
    assert(`a ${status} submission is invisible publicly`, (await publicVisible()) === 0);
  }

  await prisma.submission.update({
    where: { id: submission.id },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });
  assert('a PUBLISHED submission becomes visible', (await publicVisible()) === 5);

  // -------------------------------------------------------------------------
  // 5. Historical preservation
  // -------------------------------------------------------------------------
  console.log('\n[5] Historical preservation');

  // The database refuses submissions for a cycle that has not opened, so to
  // exercise a second cycle this test must first open the 2028 window — the
  // same deliberate administrative act a real deployment would require. The
  // original window is restored at the end of the section.
  const originalWindow = { opensAt: cycle2028.opensAt, status: cycle2028.status };
  await prisma.reportingCycle.update({
    where: { id: cycle2028.id },
    data: { opensAt: new Date(Date.now() - 86_400_000) },
  });

  const submission2028 = await prisma.submission.create({
    data: {
      countryId: country.id,
      reportingCycleId: cycle2028.id,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      expectedCount: requiredCount,
    },
  });
  created.submissionIds.push(submission2028.id);
  await mk2028(submission2028.id, scorable, indicators);

  const both = await prisma.submission.findMany({
    where: { countryId: country.id },
    include: { reportingCycle: true },
    orderBy: { reportingCycle: { reportingYear: 'asc' } },
  });
  assert('2026 and 2028 coexist as separate records', both.length === 2);

  const v2026 = await prisma.submissionValue.findFirst({
    where: { submissionId: submission.id, indicatorId: scorable.id },
  });
  assert(
    'the 2026 value is unchanged by the 2028 submission',
    Number(v2026?.actualValue) === 150,
    String(v2026?.actualValue),
  );

  let duplicateRejected = false;
  try {
    await prisma.submission.create({
      data: {
        countryId: country.id,
        reportingCycleId: cycle2026.id,
        status: 'DRAFT',
        expectedCount: requiredCount,
      },
    });
  } catch {
    duplicateRejected = true;
  }
  assert('a second submission for the same cycle is rejected by the database', duplicateRejected);

  // Restore the 2028 window so the reporting schedule is left exactly as found.
  await prisma.reportingCycle.update({
    where: { id: cycle2028.id },
    data: originalWindow,
  });

  // -------------------------------------------------------------------------
  // 6. Reporting-window enforcement at the database level
  // -------------------------------------------------------------------------
  console.log('\n[6] Reporting-window enforcement (database trigger)');

  const futureCycle = await prisma.reportingCycle.findFirst({
    where: { opensAt: { gt: new Date() } },
    orderBy: { reportingYear: 'asc' },
  });

  if (!futureCycle) {
    console.log('  SKIP  no unopened cycle remains to test against');
  } else {
    const spare = await prisma.country.findFirst({
      where: {
        submissions: { none: { reportingCycleId: futureCycle.id } },
        iso2: { not: country.iso2 },
      },
    });

    let rejected = false;
    try {
      await prisma.submission.create({
        data: {
          countryId: spare!.id,
          reportingCycleId: futureCycle.id,
          status: 'DRAFT',
          expectedCount: requiredCount,
        },
      });
    } catch {
      rejected = true;
    }
    assert(
      `the database rejects a submission for the unopened ${futureCycle.reportingYear} cycle`,
      rejected,
    );

    // Clean up in case a future change lets it through.
    if (!rejected) {
      await prisma.submission.deleteMany({
        where: { countryId: spare!.id, reportingCycleId: futureCycle.id },
      });
    }
  }

  // -------------------------------------------------------------------------
  // 7. Indicator version pinning
  // -------------------------------------------------------------------------
  console.log('\n[7] Indicator version pinning');

  const pinned = await prisma.submissionValue.findFirst({
    where: { submissionId: submission.id, indicatorId: scorable.id },
    include: { indicatorVersion: true },
  });
  assert(
    'each value is pinned to the definition version it was captured under',
    pinned?.indicatorVersion.version === 1 &&
      pinned.indicatorVersion.sourceText === scorable.sourceText,
  );

  // -------------------------------------------------------------------------
  await cleanup();
  console.log('\n  scenario removed');

  console.log('\n' + '='.repeat(64));
  console.log(`${checks - failures} of ${checks} checks passed.`);
  if (failures > 0) {
    console.error(`${failures} FAILED.`);
    process.exit(1);
  }
  console.log('All invariants hold.');
}

async function mk2028(
  submissionId: string,
  indicator: { id: string },
  indicators: { id: string; versions: { id: string }[] }[],
) {
  const full = indicators.find((i) => i.id === indicator.id)!;
  await prisma.submissionValue.create({
    data: {
      submissionId,
      indicatorId: full.id,
      indicatorVersionId: full.versions[0]!.id,
      dataAvailable: true,
      baselineValue: 100,
      targetValue: 200,
      actualValue: 180,
      validationStatus: 'REPORTED',
      sourceName: 'National Statistics Office',
    },
  });
}

main()
  .catch(async (e) => {
    console.error('\nVerification aborted:', e);
    await cleanup().catch(() => {});
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
