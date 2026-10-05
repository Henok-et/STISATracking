/**
 * Structural verification of the extracted STISA 2034 taxonomy.
 * Run: npm run verify:taxonomy
 *
 * This does not validate the *content* against the PDF (a human must do that);
 * it guarantees the file is internally consistent and that the counts, codes
 * and cross-references hold.
 */
import {
  SECTORS,
  INDICATORS,
  EXTRACTION_RECONCILIATION,
  type IndicatorFlag,
} from '../src/data/stisa-taxonomy';

const problems: string[] = [];

// --- counts ---------------------------------------------------------------
const bySector = new Map<string, number>();
for (const i of INDICATORS) bySector.set(i.sectorCode, (bySector.get(i.sectorCode) ?? 0) + 1);

console.log('STISA 2034 — extracted taxonomy');
console.log('='.repeat(78));
console.log(`Sectors/categories : ${SECTORS.length}`);
console.log(`Indicator rows     : ${INDICATORS.length}`);
console.log('');

let level = '';
for (const s of SECTORS) {
  if (s.resultLevel !== level) {
    level = s.resultLevel;
    console.log(`\n[${level}]`);
  }
  const n = bySector.get(s.code) ?? 0;
  console.log(`  ${s.code.padEnd(4)} ${String(n).padStart(2)}  ${s.name}`);
}

// --- integrity ------------------------------------------------------------
const codes = INDICATORS.map((i) => i.code);
if (new Set(codes).size !== codes.length) problems.push('Duplicate indicator codes present.');

for (const i of INDICATORS) {
  if (!SECTORS.some((s) => s.code === i.sectorCode))
    problems.push(`${i.code}: unknown sectorCode "${i.sectorCode}"`);
  for (const c of i.relatedCodes)
    if (!codes.includes(c)) problems.push(`${i.code}: relatedCode "${c}" does not exist`);
  if (i.relatedCodes.includes(i.code)) problems.push(`${i.code}: relatedCodes references itself`);
  if (!i.sourceText.trim()) problems.push(`${i.code}: empty sourceText`);
  if (i.definition !== null) problems.push(`${i.code}: definition must be null (source has none)`);
  if (i.calculationMethod === 'UNDEFINED' && i.calculationProvenance !== 'NOT_PROVIDED')
    problems.push(`${i.code}: UNDEFINED method must have provenance NOT_PROVIDED`);
}

// ordering within a sector must follow the printed rows
for (const s of SECTORS) {
  const rows = INDICATORS.filter((i) => i.sectorCode === s.code);
  rows.forEach((r, idx) => {
    if (r.sourceRow !== idx + 1)
      problems.push(`${r.code}: sourceRow ${r.sourceRow} is out of order (expected ${idx + 1})`);
  });
}

// --- flag register --------------------------------------------------------
const flagCount = new Map<IndicatorFlag, number>();
for (const i of INDICATORS)
  for (const f of i.flags) flagCount.set(f, (flagCount.get(f) ?? 0) + 1);

console.log('\n\nAmbiguity register');
console.log('='.repeat(78));
for (const [flag, n] of [...flagCount].sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(n).padStart(3)}  ${flag}`);

const notable = INDICATORS.filter((i) =>
  i.flags.some((f) =>
    (['COMPOUND_STATEMENT', 'DUPLICATE_OF_ANOTHER_ROW'] as IndicatorFlag[]).includes(f),
  ),
);
console.log('\nCompound / duplicate rows requiring AU clarification:');
for (const i of notable)
  console.log(`  ${i.code.padEnd(8)} ${i.flags.filter((f) => !f.startsWith('NO_')).join(', ')}`);

console.log('\n\nCount reconciliation');
console.log('='.repeat(78));
console.log(`  rows printed in source     : ${EXTRACTION_RECONCILIATION.rowsPrintedInSource}`);
console.log(`  Impact-level rows excluded : ${EXTRACTION_RECONCILIATION.rowsExcludedImpactLevel}`);
console.log(`  rows in scope              : ${EXTRACTION_RECONCILIATION.rowsInScope}`);
console.log(`  count stated in brief      : ${EXTRACTION_RECONCILIATION.countStatedInProjectBrief}`);
console.log(`  discrepancy                : ${EXTRACTION_RECONCILIATION.discrepancy}`);
console.log(
  `  candidate compound rows    : ${EXTRACTION_RECONCILIATION.compoundRowsThatCouldResolveTheDiscrepancy.join(', ')}`,
);

// --- result ---------------------------------------------------------------
console.log('');
if (problems.length) {
  console.error('FAILED — structural problems:');
  for (const p of problems) console.error(`  • ${p}`);
  process.exit(1);
}
console.log('OK — taxonomy is internally consistent.');
