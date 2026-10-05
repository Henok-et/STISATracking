/**
 * Confirms every AU Member State has a globe coordinate, and that each one
 * falls inside a plausible African bounding box.
 *
 * Without this a missing or mistyped entry would silently drop a marker from
 * the hero globe, or place one in the wrong ocean, with nothing to catch it.
 *
 * Run: npm run verify:coordinates
 */
import { COUNTRY_COORDINATES } from '../src/data/country-coordinates';
import { AU_MEMBER_STATES } from '../src/data/au-member-states';

// Generous box around the African continent and its island states
// (Cabo Verde west, Mauritius east, Tunisia north, South Africa south).
const BBOX = { minLat: -36, maxLat: 38, minLng: -26, maxLng: 60 };

const problems: string[] = [];

const missing = AU_MEMBER_STATES.filter((c) => !COUNTRY_COORDINATES[c.iso2]);
for (const m of missing) problems.push(`${m.iso2} (${m.shortName}) has no coordinate`);

const orphans = Object.keys(COUNTRY_COORDINATES).filter(
  (k) => !AU_MEMBER_STATES.some((c) => c.iso2 === k),
);
for (const o of orphans) problems.push(`${o} is not an AU Member State`);

for (const [iso2, { lat, lng }] of Object.entries(COUNTRY_COORDINATES)) {
  if (lat < BBOX.minLat || lat > BBOX.maxLat || lng < BBOX.minLng || lng > BBOX.maxLng) {
    problems.push(`${iso2} at ${lat},${lng} falls outside the African bounding box`);
  }
}

console.log('Globe coordinates');
console.log('='.repeat(52));
console.log(`  AU Member States   ${AU_MEMBER_STATES.length}`);
console.log(`  coordinates        ${Object.keys(COUNTRY_COORDINATES).length}`);
console.log('');

if (problems.length) {
  console.error('FAILED:');
  for (const p of problems) console.error(`  • ${p}`);
  process.exit(1);
}
console.log('OK — every Member State maps to a plausible African coordinate.');
