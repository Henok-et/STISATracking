/**
 * Connectivity and seed-integrity check.
 * Run: npm run db:check
 *
 * Verifies the database is reachable and that the reference data the platform
 * depends on is present and internally consistent.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const [regions, countries, sectors, indicators, versions, cycles, admins] = await Promise.all([
    prisma.region.count(),
    prisma.country.count(),
    prisma.sector.count(),
    prisma.indicator.count(),
    prisma.indicatorVersion.count(),
    prisma.reportingCycle.count(),
    prisma.user.count({ where: { role: 'ADMIN' } }),
  ]);

  const openCycle = await prisma.reportingCycle.findFirst({ where: { status: 'OPEN' } });
  const orphanIndicators = await prisma.indicator.count({ where: { versions: { none: {} } } });

  console.log('Database connectivity: OK');
  console.log('='.repeat(50));
  console.log(`  regions             ${regions}`);
  console.log(`  countries           ${countries}`);
  console.log(`  sectors             ${sectors}`);
  console.log(`  indicators          ${indicators}`);
  console.log(`  indicator versions  ${versions}`);
  console.log(`  reporting cycles    ${cycles}`);
  console.log(`  administrators      ${admins}`);
  console.log(`  open cycle          ${openCycle?.label ?? 'none — reporting is closed'}`);

  const problems: string[] = [];
  if (regions !== 5) problems.push(`Expected 5 AU regions, found ${regions}.`);
  if (countries !== 55) problems.push(`Expected 55 AU Member States, found ${countries}.`);
  if (indicators === 0) problems.push('No indicators seeded.');
  if (orphanIndicators > 0)
    problems.push(`${orphanIndicators} indicators have no definition version.`);
  if (cycles !== 4) problems.push(`Expected 4 reporting cycles, found ${cycles}.`);
  if (admins === 0) problems.push('No administrator account exists.');

  console.log('');
  if (problems.length) {
    console.error('FAILED:');
    for (const p of problems) console.error(`  • ${p}`);
    process.exit(1);
  }
  console.log('OK — reference data is complete and consistent.');
}

main()
  .catch((e) => {
    console.error('Database check FAILED:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
