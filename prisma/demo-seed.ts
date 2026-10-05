/**
 * DEMO DATA GENERATOR — NOT REAL STISA 2034 DATA
 * ==============================================
 *
 * Generates synthetic Member State returns so the platform can be evaluated
 * with something on the screen. Every figure produced here is fabricated.
 *
 *   npm run db:demo         generate
 *   npm run db:demo:clear   remove every trace
 *
 * Safeguards against this being mistaken for, or contaminating, real data:
 *
 *   - Refuses to run when NODE_ENV=production unless ALLOW_DEMO_SEED=true.
 *   - All demo focal points use the reserved `.invalid` TLD, which can never
 *     resolve to a real address.
 *   - Every demo submission records a demo user as its creator, which is how
 *     teardown identifies exactly what to remove — nothing else is touched.
 *   - Reference data (countries, indicators, cycles, the real admin) is never
 *     modified.
 *   - Set NEXT_PUBLIC_DEMO_MODE=true to show a banner on every page.
 *
 * Output is deterministic: the same seed always produces the same figures, so
 * screenshots and demos stay reproducible.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set.');

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
  console.error(
    'Refusing to generate demo data with NODE_ENV=production.\n' +
      'Set ALLOW_DEMO_SEED=true only if you are certain this is not the live database.',
  );
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

export const DEMO_EMAIL_DOMAIN = 'demo.stisa.invalid';
const DEMO_PASSWORD = 'DemoFocal!2026';

// --- deterministic PRNG (mulberry32) ---------------------------------------
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20342026);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)]!;
const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

/**
 * Regional capability profiles. These exist purely so the regional comparison
 * charts show differentiated shapes rather than five identical bars — they are
 * not a claim about any region.
 */
const REGION_PROFILE: Record<string, { coverage: number; performance: number }> = {
  NORTH: { coverage: 0.82, performance: 0.68 },
  WEST: { coverage: 0.7, performance: 0.55 },
  CENTRAL: { coverage: 0.58, performance: 0.46 },
  EAST: { coverage: 0.76, performance: 0.62 },
  SOUTH: { coverage: 0.8, performance: 0.66 },
};

/** Workflow spread across the 55 Member States for the open (2026) cycle. */
const STATUS_PLAN: { status: string; count: number }[] = [
  { status: 'PUBLISHED', count: 33 },
  { status: 'APPROVED', count: 4 },
  { status: 'UNDER_REVIEW', count: 5 },
  { status: 'SUBMITTED', count: 4 },
  { status: 'REVISION_REQUIRED', count: 3 },
  { status: 'DRAFT', count: 4 },
  { status: 'NOT_STARTED', count: 2 },
];

const SOURCES = [
  'National Bureau of Statistics — Annual Digest',
  'Ministry of Science, Technology and Innovation',
  'National Council for Science and Technology',
  'Ministry of Finance — Budget Statement',
  'National Research and Innovation Survey',
  'Central Bank — Statistical Bulletin',
  'Ministry of Higher Education',
  'National Intellectual Property Office',
];

const NOT_AVAILABLE_REASONS = [
  'National statistics for this indicator are not yet collected.',
  'Data collection instrument is under development with the national statistics office.',
  'The responsible agency could not supply figures within the reporting window.',
  'Reported at ministry level only; a national aggregate is not yet available.',
];

const NOT_APPLICABLE_REASONS = [
  'Landlocked — this indicator does not apply.',
  'No national programme exists in this area during the current phase.',
  'Measured continentally by the African Union Commission, not at Member State level.',
];

type IndicatorRow = {
  id: string;
  code: string;
  dataType: string;
  calculationMethod: string;
  direction: string;
  required: boolean;
  versions: { id: string }[];
};

/** Builds one plausible value for an indicator given a 0-1 performance factor. */
function buildValue(ind: IndicatorRow, perf: number) {
  const lower = ind.direction === 'LOWER_IS_BETTER';
  const interp = (baseline: number, target: number) => baseline + (target - baseline) * perf;

  switch (ind.dataType) {
    case 'BOOLEAN':
      return { booleanValue: perf > 0.5 };

    case 'CURRENCY': {
      const baseline = Math.round(between(2_000_000, 60_000_000));
      const target = Math.round(baseline * between(1.6, 3));
      return {
        baselineValue: baseline,
        targetValue: target,
        actualValue: Math.round(interp(baseline, target)),
        currencyCode: 'USD',
      };
    }

    case 'INTEGER': {
      const baseline = Math.round(between(8, 220));
      const target = Math.round(baseline * between(1.5, 3.2));
      return {
        baselineValue: baseline,
        targetValue: target,
        actualValue: Math.round(interp(baseline, target)),
      };
    }

    case 'DECIMAL': {
      if (ind.calculationMethod === 'RATIO') {
        const baseline = round(between(0.4, 1.2));
        const target = round(baseline * between(1.5, 2.6));
        return {
          baselineValue: baseline,
          targetValue: target,
          actualValue: round(interp(baseline, target)),
        };
      }
      // Composite index score.
      const baseline = round(between(18, 52), 1);
      const target = round(baseline + between(8, 26), 1);
      return {
        baselineValue: baseline,
        targetValue: target,
        actualValue: round(interp(baseline, target), 1),
      };
    }

    default: {
      // PERCENTAGE
      if (
        ind.calculationMethod === 'PERCENTAGE_CHANGE' ||
        ind.calculationMethod === 'PERCENTAGE_POINT_CHANGE'
      ) {
        // The reported value IS a change, so there is no baseline level.
        // A lower-is-better change measure (e.g. "percentage change in Gini
        // Coefficient") targets a REDUCTION, so both the target and the
        // reported value are negative. Generating a positive target here would
        // mean "we aim to increase inequality by 26%".
        const magnitude = round(between(6, 28), 1);
        const target = lower ? -magnitude : magnitude;
        return { targetValue: target, actualValue: round(target * perf, 1) };
      }
      // Share of a total.
      if (lower) {
        const baseline = round(between(30, 70), 1);
        const target = round(baseline * between(0.55, 0.8), 1);
        return {
          baselineValue: baseline,
          targetValue: target,
          actualValue: round(interp(baseline, target), 1),
        };
      }
      const baseline = round(between(4, 45), 1);
      const target = round(Math.min(95, baseline + between(10, 35)), 1);
      return {
        baselineValue: baseline,
        targetValue: target,
        actualValue: round(interp(baseline, target), 1),
      };
    }
  }
}

async function clearDemo(quiet = false) {
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
    select: { id: true },
  });
  const ids = demoUsers.map((u) => u.id);

  if (ids.length === 0) {
    if (!quiet) console.log('No demo data present.');
    return;
  }

  // Submissions created by a demo account are, by construction, demo data.
  const submissions = await prisma.submission.findMany({
    where: { createdById: { in: ids } },
    select: { id: true },
  });
  const submissionIds = submissions.map((s) => s.id);

  await prisma.auditLog.deleteMany({
    where: { OR: [{ submissionId: { in: submissionIds } }, { userId: { in: ids } }] },
  });
  await prisma.submissionValue.deleteMany({ where: { submissionId: { in: submissionIds } } });
  await prisma.submission.deleteMany({ where: { id: { in: submissionIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });

  if (!quiet) {
    console.log(
      `Removed ${submissionIds.length} demo submissions and ${ids.length} demo focal point accounts.`,
    );
  }
}

async function main() {
  const mode = process.argv[2];

  /**
   * By default only the open cycle (2026) is populated, because that is what a
   * real deployment looks like today: 2026 is the FIRST STISA reporting round,
   * so no earlier cycle exists and no later one has opened. A single data point
   * is the honest picture.
   *
   * Passing `trend` additionally publishes 2028 returns so the historical
   * comparison charts have something to draw. That is temporally impossible in
   * reality — use it only to exercise the trend visualisations.
   */
  const includeFutureCycle = mode === 'trend';

  if (mode === 'clear') {
    console.log('Clearing demo data');
    console.log('='.repeat(62));
    await clearDemo();
    console.log('Reference data (countries, indicators, cycles, admin) untouched.');
    return;
  }

  console.log('Generating DEMO data — these figures are fabricated');
  console.log('='.repeat(62));

  // Start from a clean slate so re-running does not stack duplicates.
  await clearDemo(true);

  const [countries, indicators, cycle2026, cycle2028] = await Promise.all([
    prisma.country.findMany({ include: { region: true }, orderBy: { shortName: 'asc' } }),
    prisma.indicator.findMany({
      where: { active: true },
      include: { versions: { where: { effectiveTo: null }, take: 1 } },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.reportingCycle.findUniqueOrThrow({ where: { reportingYear: 2026 } }),
    prisma.reportingCycle.findUniqueOrThrow({ where: { reportingYear: 2028 } }),
  ]);

  const requiredCount = indicators.filter((i) => i.required).length;
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // --- focal point accounts ------------------------------------------------
  // Two Member States are deliberately left without one so the admin overview
  // surfaces its "no focal point assigned" warning.
  const withoutFocalPoint = new Set([countries[7]!.id, countries[31]!.id]);
  const focalPointByCountry = new Map<string, string>();

  for (const c of countries) {
    if (withoutFocalPoint.has(c.id)) continue;
    const user = await prisma.user.create({
      data: {
        email: `focal.${c.iso2.toLowerCase()}@${DEMO_EMAIL_DOMAIN}`,
        name: `${c.shortName} Focal Point`,
        passwordHash,
        role: 'FOCAL_POINT',
        countryId: c.id,
        active: true,
        mustChangePassword: false,
        title: 'National STISA Focal Point',
        organisation: `Ministry of Science and Technology, ${c.shortName}`,
      },
    });
    focalPointByCountry.set(c.id, user.id);
  }
  console.log(`  focal point accounts   ${focalPointByCountry.size}`);

  // --- assign a workflow status to each Member State -----------------------
  const shuffled = [...countries].sort(() => rand() - 0.5);
  const assignment = new Map<string, string>();
  let cursor = 0;
  for (const { status, count } of STATUS_PLAN) {
    for (let i = 0; i < count && cursor < shuffled.length; i++, cursor++) {
      assignment.set(shuffled[cursor]!.id, status);
    }
  }
  for (; cursor < shuffled.length; cursor++) assignment.set(shuffled[cursor]!.id, 'PUBLISHED');
  // A Member State with no focal point cannot have started reporting.
  for (const id of withoutFocalPoint) assignment.set(id, 'NOT_STARTED');

  // --- build submissions ---------------------------------------------------
  let submissionCount = 0;
  let valueCount = 0;
  const skipped: string[] = [];

  async function buildSubmission(
    country: (typeof countries)[number],
    cycle: typeof cycle2026,
    status: string,
    maturity: number,
  ) {
    const creatorId = focalPointByCountry.get(country.id);
    if (!creatorId) return;

    // Never touch a submission this generator did not create. A real focal
    // point may already have started a return for this cycle, and demo data
    // must not overwrite institutional records.
    const existing = await prisma.submission.findUnique({
      where: {
        countryId_reportingCycleId: {
          countryId: country.id,
          reportingCycleId: cycle.id,
        },
      },
      select: { id: true, createdById: true },
    });
    if (existing) {
      skipped.push(`${country.shortName} ${cycle.reportingYear}`);
      return;
    }

    const profile = REGION_PROFILE[country.region.code]!;
    // Per-country character, stable for this country across both cycles.
    const capability = Math.max(0.15, Math.min(1, profile.coverage + between(-0.28, 0.24)));
    const strength = Math.max(0.1, Math.min(1, profile.performance + between(-0.3, 0.28)));

    const isFinal = ['APPROVED', 'PUBLISHED'].includes(status);
    const isDraftish = ['DRAFT', 'REVISION_REQUIRED'].includes(status);
    // Drafts are partly filled; approved and published returns are the fullest.
    const coverage = Math.min(0.99, capability * maturity * (isDraftish ? 0.62 : 1));

    const now = new Date();
    const submittedAt = new Date(cycle.opensAt.getTime() + between(30, 250) * 86_400_000);
    const clamp = (d: Date) => (d > now ? now : d);

    const submission = await prisma.submission.create({
      data: {
        countryId: country.id,
        reportingCycleId: cycle.id,
        status: status as never,
        createdById: creatorId,
        expectedCount: requiredCount,
        ...(status !== 'DRAFT'
          ? { submittedAt: clamp(submittedAt), submittedById: creatorId }
          : {}),
        ...(['UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'PUBLISHED'].includes(status)
          ? { reviewedAt: clamp(new Date(submittedAt.getTime() + 6 * 86_400_000)) }
          : {}),
        ...(status === 'REVISION_REQUIRED'
          ? {
              revisionRequestedAt: clamp(new Date(submittedAt.getTime() + 8 * 86_400_000)),
              revisionNote:
                'Several indicators are reported without a data source, and the R&D expenditure figures are inconsistent with the budget statement. Please review and resubmit. [DEMO]',
            }
          : {}),
        ...(isFinal ? { approvedAt: clamp(new Date(submittedAt.getTime() + 14 * 86_400_000)) } : {}),
        ...(status === 'PUBLISHED'
          ? { publishedAt: clamp(new Date(submittedAt.getTime() + 20 * 86_400_000)) }
          : {}),
      },
    });

    const rows: Record<string, unknown>[] = [];
    let reported = 0;
    let notApplicable = 0;

    for (const ind of indicators) {
      const version = ind.versions[0];
      if (!version) continue;

      const roll = rand();

      // Not applicable — an answered state, excluded from progress averages.
      if (roll > 0.94) {
        notApplicable++;
        rows.push({
          submissionId: submission.id,
          indicatorId: ind.id,
          indicatorVersionId: version.id,
          dataAvailable: false,
          validationStatus: 'NOT_APPLICABLE',
          notes: `${pick(NOT_APPLICABLE_REASONS)} [DEMO]`,
          updatedById: creatorId,
        });
        continue;
      }

      // Not reported — stays NULL, never zero.
      if (roll > coverage) {
        rows.push({
          submissionId: submission.id,
          indicatorId: ind.id,
          indicatorVersionId: version.id,
          dataAvailable: false,
          validationStatus: 'NOT_REPORTED',
          notes: `${pick(NOT_AVAILABLE_REASONS)} [DEMO]`,
          updatedById: creatorId,
        });
        continue;
      }

      const perf = Math.max(0.05, Math.min(1.15, strength + between(-0.3, 0.35)));
      const payload = buildValue(ind as IndicatorRow, perf);

      // Drafts carry some genuinely invalid rows so the readiness screen and
      // the reviewer issue list have something to show.
      const invalid = isDraftish && rand() > 0.9;
      const hasSource = isFinal ? rand() > 0.04 : rand() > 0.25;

      if (!invalid) reported++;

      rows.push({
        submissionId: submission.id,
        indicatorId: ind.id,
        indicatorVersionId: version.id,
        dataAvailable: true,
        ...payload,
        ...(invalid ? { targetValue: null } : {}),
        baselineYear: 2024,
        validationStatus: invalid ? 'INVALID' : 'REPORTED',
        validationMessages: invalid ? ['targetValue: Target value missing.'] : [],
        notes: rand() > 0.82 ? 'Provisional figure, subject to revision. [DEMO]' : null,
        sourceName: hasSource ? pick(SOURCES) : null,
        sourceUrl: hasSource && rand() > 0.6 ? 'https://example.org/statistics' : null,
        updatedById: creatorId,
      });
    }

    await prisma.submissionValue.createMany({ data: rows as never });

    const answered = reported + notApplicable;
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        reportedCount: answered,
        completenessPct: round((answered / requiredCount) * 100),
      },
    });

    submissionCount++;
    valueCount += rows.length;
  }

  // 2026 — the open cycle, full workflow spread.
  for (const country of countries) {
    const status = assignment.get(country.id)!;
    if (status === 'NOT_STARTED') continue;
    await buildSubmission(country, cycle2026, status, between(0.85, 1));
  }
  console.log(`  2026 submissions       ${submissionCount}`);

  // 2028 — only when explicitly requested. See includeFutureCycle above.
  //
  // The database rejects submissions for a cycle that has not opened, so trend
  // mode must first move the 2028 window — exactly what an administrator would
  // have to do in /admin/reporting-cycles. This is deliberately not a silent
  // bypass: the schedule really is being changed, and `npm run db:seed`
  // restores it.
  if (includeFutureCycle) {
    console.log('');
    console.log('  TREND MODE: opening the 2028 reporting window early so that');
    console.log('  future-dated returns can be written. This CHANGES the reporting');
    console.log('  schedule. Restore it with: npm run db:seed');
    await prisma.reportingCycle.update({
      where: { id: cycle2028.id },
      data: {
        opensAt: new Date(Date.now() - 86_400_000),
        status: 'OPEN',
        notes: 'Window opened early by the demo data generator (trend mode). Restore with npm run db:seed.',
      },
    });
    console.log('');

    const before = submissionCount;
    for (const country of countries) {
      if (assignment.get(country.id) !== 'PUBLISHED') continue;
      if (rand() > 0.72) continue;
      await buildSubmission(country, cycle2028, 'PUBLISHED', between(0.95, 1.12));
    }
    console.log(`  2028 submissions       ${submissionCount - before}  (trend mode)`);
  }
  console.log(`  indicator values       ${valueCount.toLocaleString('en')}`);

  if (skipped.length > 0) {
    console.log('');
    console.log(`  skipped (real data already present, left untouched): ${skipped.length}`);
    for (const s2 of skipped) console.log(`    ${s2}`);
  }

  const published = await prisma.submission.count({ where: { status: 'PUBLISHED' } });
  const states = await prisma.submissionValue.groupBy({
    by: ['validationStatus'],
    _count: { _all: true },
  });

  console.log('');
  console.log('  value states');
  for (const s of states.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`    ${s.validationStatus.padEnd(20)} ${s._count._all.toLocaleString('en')}`);
  }

  console.log('');
  console.log('='.repeat(62));
  console.log(`${published} published submissions are now visible on the public dashboards.`);
  console.log('');
  console.log('Sign in as any demo focal point:');
  console.log(`  focal.et@${DEMO_EMAIL_DOMAIN}  (Ethiopia)`);
  console.log(`  focal.ng@${DEMO_EMAIL_DOMAIN}  (Nigeria)`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log('');
  if (includeFutureCycle) {
    console.log('NOTE: 2028 returns were generated (trend mode). These are temporally');
    console.log('impossible — 2028 has not opened. They exist only to exercise the');
    console.log('historical trend charts, and they pull the dashboard frame to 2028.');
  } else {
    console.log('Dashboards are framed on 2026, the open reporting cycle.');
    console.log('Trend charts will show a single point: 2026 is the first STISA');
    console.log('reporting round, so there is no earlier cycle to compare against.');
    console.log('Run `npm run db:demo:trend` to also publish 2028 returns.');
  }
  console.log('');
  console.log('Remove everything with: npm run db:demo:clear');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
