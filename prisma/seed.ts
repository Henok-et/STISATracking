/**
 * Seeds the reference data the platform cannot function without:
 *
 *   - the 5 official AU geographical regions
 *   - all 55 AU Member States
 *   - the 18 MEAL Plan categories and every indicator row extracted from the
 *     Implementation Plan STISA 2034, Annexure 1
 *   - version 1 of every indicator definition
 *   - the 4 official reporting cycles (2026, 2028, 2030, 2033)
 *   - one AU administrator account
 *
 * The seed is idempotent: re-running it updates existing rows rather than
 * duplicating them, and it never touches submissions or submitted values.
 *
 * Run:  npm run db:seed
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

import { REGIONS, AU_MEMBER_STATES } from '../src/data/au-member-states';
import { SECTORS, INDICATORS, EXTRACTION_RECONCILIATION } from '../src/data/stisa-taxonomy';
import { REPORTING_CYCLES } from '../src/data/reporting-cycles';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

function cycleStatus(now: Date, opensAt: Date, closesAt: Date) {
  if (now < opensAt) return 'PLANNED' as const;
  if (now > closesAt) return 'CLOSED' as const;
  return 'OPEN' as const;
}

async function seedRegions() {
  for (const r of REGIONS) {
    await prisma.region.upsert({
      where: { code: r.code },
      update: { name: r.name, sortOrder: r.sortOrder },
      create: r,
    });
  }
  console.log(`  regions             ${REGIONS.length}`);
}

async function seedCountries() {
  const regions = await prisma.region.findMany();
  const regionId = new Map(regions.map((r) => [r.code, r.id]));

  for (const c of AU_MEMBER_STATES) {
    const rid = regionId.get(c.regionCode);
    if (!rid) throw new Error(`Unknown region "${c.regionCode}" for ${c.shortName}`);
    await prisma.country.upsert({
      where: { iso2: c.iso2 },
      update: { name: c.name, shortName: c.shortName, iso3: c.iso3, regionId: rid },
      create: {
        name: c.name,
        shortName: c.shortName,
        iso2: c.iso2,
        iso3: c.iso3,
        regionId: rid,
      },
    });
  }
  console.log(`  countries           ${AU_MEMBER_STATES.length}`);
}

async function seedSectors() {
  for (const s of SECTORS) {
    await prisma.sector.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        subtitle: s.subtitle,
        resultLevel: s.resultLevel,
        resultStatement: s.resultStatement,
        sortOrder: s.sortOrder,
      },
      create: {
        code: s.code,
        name: s.name,
        subtitle: s.subtitle,
        resultLevel: s.resultLevel,
        resultStatement: s.resultStatement,
        sortOrder: s.sortOrder,
      },
    });
  }
  console.log(`  sectors             ${SECTORS.length}`);
}

async function seedIndicators() {
  const sectors = await prisma.sector.findMany();
  const sectorId = new Map(sectors.map((s) => [s.code, s.id]));

  let created = 0;
  let updated = 0;

  for (const [idx, ind] of INDICATORS.entries()) {
    const sid = sectorId.get(ind.sectorCode);
    if (!sid) throw new Error(`Unknown sector "${ind.sectorCode}" for ${ind.code}`);

    const definitional = {
      officialName: ind.officialName,
      sourceText: ind.sourceText,
      definition: ind.definition,
      description: null,
      unit: ind.unit,
      dataType: ind.dataType,
      calculationMethod: ind.calculationMethod,
      direction: ind.direction,
      unitOfAnalysis: ind.unitOfAnalysis,
      flags: ind.flags,
      ambiguityNote: ind.ambiguityNote,
      required: true,
      // A source citation cannot reasonably be demanded for indicators whose
      // methodology the source never defined.
      sourceRequired: ind.calculationMethod !== 'UNDEFINED',
    };

    const existing = await prisma.indicator.findUnique({ where: { code: ind.code } });

    if (!existing) {
      const record = await prisma.indicator.create({
        data: {
          code: ind.code,
          sectorId: sid,
          ...definitional,
          unitProvenance: ind.unitProvenance,
          dataTypeProvenance: ind.dataTypeProvenance,
          calculationProvenance: ind.calculationProvenance,
          directionProvenance: ind.directionProvenance,
          relatedCodes: ind.relatedCodes,
          sourcePage: ind.sourcePage,
          sourceRow: ind.sourceRow,
          sortOrder: idx,
          currentVersion: 1,
        },
      });
      await prisma.indicatorVersion.create({
        data: {
          indicatorId: record.id,
          version: 1,
          ...definitional,
          changeReason:
            'Initial version seeded from Implementation Plan STISA 2034, Annexure 1: MEAL Plan.',
        },
      });
      created++;
    } else {
      await prisma.indicator.update({
        where: { id: existing.id },
        data: {
          sectorId: sid,
          ...definitional,
          unitProvenance: ind.unitProvenance,
          dataTypeProvenance: ind.dataTypeProvenance,
          calculationProvenance: ind.calculationProvenance,
          directionProvenance: ind.directionProvenance,
          relatedCodes: ind.relatedCodes,
          sourcePage: ind.sourcePage,
          sourceRow: ind.sourceRow,
          sortOrder: idx,
        },
      });
      // Keep version 1 in step with the seed while no data has been collected.
      // Once submissions exist, definition changes must go through
      // createIndicatorVersion() in src/lib/indicators/versioning.ts instead.
      await prisma.indicatorVersion.updateMany({
        where: { indicatorId: existing.id, version: existing.currentVersion },
        data: definitional,
      });
      updated++;
    }
  }
  console.log(`  indicators          ${INDICATORS.length} (${created} created, ${updated} updated)`);
}

async function seedReportingCycles() {
  const now = new Date();
  for (const c of REPORTING_CYCLES) {
    const status = cycleStatus(now, c.opensAt, c.closesAt);
    await prisma.reportingCycle.upsert({
      where: { reportingYear: c.reportingYear },
      update: {
        phase: c.phase,
        implementationStartYear: c.implementationStartYear,
        implementationEndYear: c.implementationEndYear,
        opensAt: c.opensAt,
        closesAt: c.closesAt,
        label: c.label,
        status,
        active: status === 'OPEN',
      },
      create: {
        phase: c.phase,
        implementationStartYear: c.implementationStartYear,
        implementationEndYear: c.implementationEndYear,
        reportingYear: c.reportingYear,
        opensAt: c.opensAt,
        closesAt: c.closesAt,
        label: c.label,
        status,
        active: status === 'OPEN',
      },
    });
  }
  const open = await prisma.reportingCycle.findFirst({ where: { active: true } });
  console.log(
    `  reporting cycles    ${REPORTING_CYCLES.length} (active: ${open ? open.label : 'none — reporting is closed this year'})`,
  );
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@au-stisa.org').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME ?? 'STISA Administrator';

  if (!password) {
    console.log('  admin               skipped (SEED_ADMIN_PASSWORD not set)');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`  admin               unchanged (${email} already exists)`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: 'ADMIN',
      countryId: null,
      active: true,
      mustChangePassword: true,
    },
  });
  console.log(`  admin               created (${email}) — must change password on first login`);
}

async function seedDemoFocalPoints() {
  if (process.env.SEED_DEMO_FOCAL_POINTS !== 'true') return;

  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026';
  const passwordHash = await bcrypt.hash(password, 12);
  const regions = await prisma.region.findMany({ orderBy: { sortOrder: 'asc' } });

  let n = 0;
  for (const region of regions) {
    const country = await prisma.country.findFirst({
      where: { regionId: region.id },
      orderBy: { shortName: 'asc' },
    });
    if (!country) continue;
    const email = `focal.${country.iso2.toLowerCase()}@au-stisa.org`;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) continue;
    await prisma.user.create({
      data: {
        email,
        name: `${country.shortName} Focal Point`,
        passwordHash,
        role: 'FOCAL_POINT',
        countryId: country.id,
        active: true,
        mustChangePassword: true,
        organisation: `Ministry of Science and Technology, ${country.shortName}`,
      },
    });
    n++;
  }
  console.log(`  demo focal points   ${n}`);
}

async function main() {
  console.log('Seeding STISA 2034 reference data');
  console.log('='.repeat(60));

  await seedRegions();
  await seedCountries();
  await seedSectors();
  await seedIndicators();
  await seedReportingCycles();
  await seedAdmin();
  await seedDemoFocalPoints();

  console.log('='.repeat(60));
  console.log(
    `Extraction note: ${EXTRACTION_RECONCILIATION.rowsInScope} of the ` +
      `${EXTRACTION_RECONCILIATION.rowsPrintedInSource} MEAL Plan rows are in scope ` +
      `(${EXTRACTION_RECONCILIATION.rowsExcludedImpactLevel} Impact-level rows excluded); ` +
      `the project brief states ${EXTRACTION_RECONCILIATION.countStatedInProjectBrief}. ` +
      `See docs/INDICATOR-EXTRACTION.md.`,
  );
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
