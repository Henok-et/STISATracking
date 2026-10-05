/**
 * Extracts the 55 AU Member State boundaries from Natural Earth into a single
 * GeoJSON file the globe can ship to the browser.
 *
 * Run: npm run build:geo   (output is committed; only re-run if the AU
 *                           membership list or the atlas resolution changes)
 *
 * The full world atlas is ~600KB and covers ~180 countries. Filtering to the
 * AU membership at build time keeps the client payload to the continent we
 * actually render.
 *
 * Natural Earth identifies countries by ISO 3166-1 NUMERIC code, while the rest
 * of this platform keys on alpha-2, so the mapping below is the bridge. It is
 * the only place the two coding systems meet.
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as topojson from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

import { AU_MEMBER_STATES } from '../src/data/au-member-states';

const require = createRequire(import.meta.url);

/** ISO 3166-1 numeric -> alpha-2, for the 55 AU Member States. */
const NUMERIC_TO_ISO2: Record<string, string> = {
  '012': 'DZ', '024': 'AO', '204': 'BJ', '072': 'BW', '854': 'BF',
  '108': 'BI', '120': 'CM', '132': 'CV', '140': 'CF', '148': 'TD',
  '174': 'KM', '178': 'CG', '180': 'CD', '384': 'CI', '262': 'DJ',
  '818': 'EG', '226': 'GQ', '232': 'ER', '748': 'SZ', '231': 'ET',
  '266': 'GA', '270': 'GM', '288': 'GH', '324': 'GN', '624': 'GW',
  '404': 'KE', '426': 'LS', '430': 'LR', '434': 'LY', '450': 'MG',
  '454': 'MW', '466': 'ML', '478': 'MR', '480': 'MU', '504': 'MA',
  '508': 'MZ', '516': 'NA', '562': 'NE', '566': 'NG', '646': 'RW',
  '678': 'ST', '686': 'SN', '690': 'SC', '694': 'SL', '706': 'SO',
  '710': 'ZA', '728': 'SS', '729': 'SD', '834': 'TZ', '768': 'TG',
  '788': 'TN', '800': 'UG', '732': 'EH', '894': 'ZM', '716': 'ZW',
};

function main() {
  const expected = AU_MEMBER_STATES.length;
  const mapped = Object.keys(NUMERIC_TO_ISO2).length;
  if (mapped !== expected) {
    throw new Error(`Numeric mapping covers ${mapped} states, expected ${expected}.`);
  }

  // 50m resolution: enough definition to read individual borders on a globe
  // without the file size of 10m.
  const topology = require('world-atlas/countries-50m.json');
  const collection = topojson.feature(
    topology,
    topology.objects.countries,
  ) as unknown as FeatureCollection<Geometry, { name?: string }>;

  const wanted = new Set(Object.keys(NUMERIC_TO_ISO2));
  const features: Feature<Geometry, { iso2: string; name: string }>[] = [];
  const found = new Set<string>();

  for (const feature of collection.features) {
    const numeric = String(feature.id ?? '').padStart(3, '0');
    if (!wanted.has(numeric)) continue;

    const iso2 = NUMERIC_TO_ISO2[numeric]!;
    const state = AU_MEMBER_STATES.find((c) => c.iso2 === iso2);
    found.add(iso2);

    features.push({
      type: 'Feature',
      id: iso2,
      // Carry our own short name rather than Natural Earth's, so labels match
      // the rest of the platform.
      properties: { iso2, name: state?.shortName ?? feature.properties?.name ?? iso2 },
      geometry: feature.geometry,
    });
  }

  const missing = AU_MEMBER_STATES.filter((c) => !found.has(c.iso2));

  const output: FeatureCollection<Geometry, { iso2: string; name: string }> = {
    type: 'FeatureCollection',
    features,
  };

  // Natural Earth ships ~10 decimal places. At globe scale a single pixel spans
  // roughly 0.1 degrees, so 2 decimals (~1 km) is already far finer than any
  // visible difference — and it cuts the payload substantially.
  const raw = JSON.stringify(output);
  const trimmed = JSON.stringify(output, (_key, value) =>
    typeof value === 'number' ? Math.round(value * 100) / 100 : value,
  );

  writeFileSync('src/data/africa-geo.json', trimmed);

  console.log('Africa boundary extraction');
  console.log('='.repeat(56));
  console.log(`  AU Member States      ${expected}`);
  console.log(`  boundaries extracted  ${features.length}`);
  console.log(
    `  output                src/data/africa-geo.json ` +
      `(${(trimmed.length / 1024).toFixed(0)} KB, down from ${(raw.length / 1024).toFixed(0)} KB)`,
  );

  if (missing.length) {
    // Small island states are dropped at coarse Natural Earth resolutions.
    // The globe falls back to a point marker for these so they are still
    // represented rather than silently absent.
    console.log('');
    console.log(`  no polygon at this resolution (${missing.length}) — rendered as markers:`);
    for (const m of missing) console.log(`    ${m.iso2}  ${m.shortName}`);
  }
}

main();
