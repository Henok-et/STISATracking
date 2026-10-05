/**
 * Builds an end-to-end test fixture: sample focal point accounts, and a filled
 * Excel workbook for each with values chosen so the resulting dashboard figures
 * are known in advance.
 *
 * The point is to have an ORACLE. Every value is derived from a fixed rule, so
 * this script can print the completeness and target-progress percentages the
 * platform must produce. If the dashboard disagrees with the table printed
 * here, the platform is wrong.
 *
 *   npm run fixtures:make     create users + workbooks in ./fixtures
 *   npm run fixtures:clear    remove the sample accounts and their submissions
 *
 * Sample accounts use the reserved `.invalid` TLD, exactly like the demo data,
 * so they can never collide with a real address.
 */
import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { calculateProgress } from '../src/lib/analytics/progress';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DOMAIN = 'test.stisa.invalid';
const PASSWORD = 'TestFocal!2026';
const OUT_DIR = 'fixtures';

/**
 * Four Member States, one per behaviour we want to see on the dashboard.
 *
 * `fillRate` is the share of indicators answered; `performance` places the
 * actual value between baseline and target, so target progress is predictable.
 */
const PROFILES = [
  { iso2: 'KE', label: 'complete and strong', fillRate: 1.0, performance: 0.9 },
  { iso2: 'GH', label: 'complete but behind', fillRate: 1.0, performance: 0.3 },
  { iso2: 'TN', label: 'partially reported', fillRate: 0.5, performance: 0.6 },
  { iso2: 'ZM', label: 'sparse', fillRate: 0.25, performance: 0.5 },
] as const;

/** Deterministic: every run produces byte-identical workbooks. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HEADERS = [
  'Indicator code',
  'Indicator (as printed in the MEAL Plan)',
  'Category',
  'Unit',
  'Expected value type',
  'Data available? (Yes/No)',
  'Not applicable? (Yes/No)',
  'Baseline',
  'Baseline year',
  '2034 target',
  'Current actual',
  'Currency (3-letter)',
  'Notes / reason if unavailable',
  'Data source',
  'Source link',
];

async function clearFixtures() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${DOMAIN}` } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return 0;

  const submissions = await prisma.submission.findMany({
    where: { createdById: { in: ids } },
    select: { id: true },
  });
  const subIds = submissions.map((s) => s.id);

  await prisma.auditLog.deleteMany({
    where: { OR: [{ submissionId: { in: subIds } }, { userId: { in: ids } }] },
  });
  await prisma.submissionValue.deleteMany({ where: { submissionId: { in: subIds } } });
  await prisma.submission.deleteMany({ where: { id: { in: subIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  return subIds.length;
}

async function main() {
  if (process.argv[2] === 'clear') {
    const n = await clearFixtures();
    console.log(`Removed ${n} fixture submissions and their sample accounts.`);
    return;
  }

  console.log('Building test fixtures');
  console.log('='.repeat(74));
  await clearFixtures();
  mkdirSync(OUT_DIR, { recursive: true });

  const cycle = await prisma.reportingCycle.findFirstOrThrow({ where: { status: 'OPEN' } });
  const indicators = await prisma.indicator.findMany({
    where: { active: true },
    include: { sector: true },
    orderBy: { sortOrder: 'asc' },
  });
  const requiredCount = indicators.filter((i) => i.required).length;
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const expectations: {
    country: string;
    label: string;
    answered: number;
    reported: number;
    completeness: number;
    scored: number;
    unscored: number;
    progress: number;
  }[] = [];

  for (const profile of PROFILES) {
    const country = await prisma.country.findUniqueOrThrow({ where: { iso2: profile.iso2 } });
    const rand = seeded(profile.iso2.charCodeAt(0) * 7919 + profile.iso2.charCodeAt(1));

    await prisma.user.create({
      data: {
        email: `focal.${profile.iso2.toLowerCase()}@${DOMAIN}`,
        name: `${country.shortName} Focal Point`,
        passwordHash,
        role: 'FOCAL_POINT',
        countryId: country.id,
        active: true,
        mustChangePassword: false,
        organisation: `Ministry of Science and Technology, ${country.shortName}`,
      },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'STISA 2034 test fixture — synthetic data';
    const sheet = wb.addWorksheet('STISA 2034 data');
    sheet.addRow(HEADERS).font = { bold: true };

    const scores: (number | null)[] = [];
    let reported = 0;

    for (const [index, ind] of indicators.entries()) {
      // Deterministic fill: the first `fillRate` share of each run of four.
      const answer = index % 4 < Math.round(profile.fillRate * 4);

      if (!answer) {
        sheet.addRow([
          ind.code, ind.sourceText, ind.sector.name, ind.unit, ind.dataType,
          'No', 'No', null, null, null, null, null,
          'National statistics for this indicator are not yet collected. [TEST FIXTURE]',
          null, null,
        ]);
        continue;
      }

      const lower = ind.direction === 'LOWER_IS_BETTER';
      const isChange =
        ind.calculationMethod === 'PERCENTAGE_CHANGE' ||
        ind.calculationMethod === 'PERCENTAGE_POINT_CHANGE';

      let baseline: number | null = null;
      let target: number;
      let actual: number;

      if (ind.dataType === 'BOOLEAN') {
        // Yes/No milestones: answer Yes when the profile performs well.
        const achieved = profile.performance >= 0.5;
        sheet.addRow([
          ind.code, ind.sourceText, ind.sector.name, ind.unit, ind.dataType,
          'Yes', 'No', null, 2024, null, achieved ? 'Yes' : 'No', null,
          null, 'National Bureau of Statistics [TEST FIXTURE]', null,
        ]);
        reported++;
        scores.push(
          calculateProgress({
            calculationMethod: ind.calculationMethod,
            direction: ind.direction,
            dataType: ind.dataType,
            baseline: null,
            target: null,
            actual: null,
            booleanValue: achieved,
          }).percent,
        );
        continue;
      }

      // Ranges are chosen per calculation method so the figures are
      // semantically plausible, not merely numeric. An earlier version used
      // baseline 100 / target 200 for everything, which produced absurdities
      // like "Percentage of smallholder farmers: 190%".
      const round1 = (n: number) => Math.round(n * 10) / 10;
      const between = (lo: number, hi: number) => lo + (hi - lo) * profile.performance;

      if (isChange) {
        // The value IS a change: a target rise, or a target reduction.
        const magnitude = 10 + Math.round(rand() * 10);
        target = lower ? -magnitude : magnitude;
        actual = round1(target * profile.performance);
      } else if (ind.calculationMethod === 'SHARE_OF_TOTAL') {
        // A share of a total is bounded by definition.
        baseline = round1(10 + rand() * 20);
        target = round1(Math.min(95, baseline + 25 + rand() * 20));
        actual = round1(baseline + (target - baseline) * profile.performance);
      } else if (ind.calculationMethod === 'INDEX_SCORE') {
        baseline = round1(25 + rand() * 15);
        target = round1(baseline + 15 + rand() * 15);
        actual = round1(baseline + (target - baseline) * profile.performance);
      } else if (ind.calculationMethod === 'RATIO') {
        baseline = round1(0.6 + rand() * 0.5);
        target = round1(baseline * 2);
        actual = round1(baseline + (target - baseline) * profile.performance);
      } else if (ind.dataType === 'CURRENCY') {
        baseline = Math.round(2_000_000 + rand() * 20_000_000);
        target = Math.round(baseline * 2.5);
        actual = Math.round(between(baseline, target));
      } else if (lower) {
        baseline = 60;
        target = 30;
        actual = round1(baseline - (baseline - target) * profile.performance);
      } else {
        // Counts.
        baseline = 40 + Math.round(rand() * 120);
        target = Math.round(baseline * 2.2);
        actual = Math.round(between(baseline, target));
      }

      sheet.addRow([
        ind.code, ind.sourceText, ind.sector.name, ind.unit, ind.dataType,
        'Yes', 'No', baseline, 2024, target, actual,
        ind.dataType === 'CURRENCY' ? 'USD' : null,
        null, 'National Bureau of Statistics [TEST FIXTURE]', null,
      ]);
      reported++;

      scores.push(
        calculateProgress({
          calculationMethod: ind.calculationMethod,
          direction: ind.direction,
          dataType: ind.dataType,
          baseline,
          target,
          actual,
        }).percent,
      );
    }

    const file = `${OUT_DIR}/${profile.iso2}_${country.shortName.replace(/[^A-Za-z]/g, '')}_${cycle.reportingYear}.xlsx`;
    await wb.xlsx.writeFile(file);

    const valid = scores.filter((s): s is number => s !== null);
    const unscored = scores.length - valid.length;
    const progress = valid.length
      ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100
      : 0;

    expectations.push({
      country: country.shortName,
      label: profile.label,
      answered: reported,
      reported,
      completeness: Math.round((reported / requiredCount) * 10000) / 100,
      scored: valid.length,
      unscored,
      progress,
    });

    console.log(`  ${country.shortName.padEnd(12)} ${profile.label.padEnd(22)} -> ${file}`);
  }

  // ---- the oracle --------------------------------------------------------
  console.log('');
  console.log('EXPECTED RESULTS once each workbook is imported and published');
  console.log('='.repeat(74));
  console.log(
    `  ${'Member State'.padEnd(14)}${'profile'.padEnd(23)}${'reported'.padEnd(11)}${'complete'.padEnd(11)}progress`,
  );
  for (const e of expectations) {
    console.log(
      `  ${e.country.padEnd(14)}${e.label.padEnd(23)}${`${e.reported}/${requiredCount}`.padEnd(11)}${`${e.completeness}%`.padEnd(11)}${e.progress}%`,
    );
  }

  const allScored = expectations.reduce((a, e) => a + e.scored, 0);
  const allUnscored = expectations.reduce((a, e) => a + e.unscored, 0);
  console.log('');
  console.log(`  values that cannot be scored (no methodology in source): ${allUnscored}`);
  console.log(`  values entering the progress average: ${allScored}`);
  console.log('');
  console.log('Sign in as any of:');
  for (const p of PROFILES) console.log(`  focal.${p.iso2.toLowerCase()}@${DOMAIN}`);
  console.log(`  password: ${PASSWORD}`);
  console.log('');
  console.log('Then: /portal/data-entry -> upload the matching workbook -> Check file -> Apply.');
  console.log('Publish via /admin/submissions to see the figures reach the public dashboard.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
