import 'server-only';

import { getPublishedFacts, type ValueFact } from '@/lib/analytics/queries';
import { toCsv } from './csv';

/**
 * Export datasets.
 *
 * These read from the same analytics layer that backs the dashboards, so an
 * exported figure can never disagree with the figure on screen.
 */

const VALUE_HEADERS = [
  'reporting_year',
  'country_iso2',
  'country',
  'au_region',
  'result_level',
  'sector_code',
  'sector',
  'indicator_code',
  'indicator',
  'unit',
  'data_type',
  'baseline',
  'target',
  'actual',
  'target_progress_pct',
  'progress_note',
  'value_state',
  'source_name',
  'source_url',
  'notes',
];

function valueRow(f: ValueFact): unknown[] {
  return [
    f.reportingYear,
    f.countryIso2,
    f.countryName,
    f.regionName,
    f.resultLevel,
    f.sectorCode,
    f.sectorName,
    f.indicatorCode,
    f.indicatorName,
    f.unit,
    f.dataType,
    f.baseline,
    f.target,
    // Only a validly reported value is exported as an actual; anything else
    // leaves the cell empty rather than implying a figure.
    f.validationStatus === 'REPORTED' ? f.actual : null,
    f.progressPct,
    f.progressPct === null ? f.progressExplanation : null,
    f.validationStatus,
    f.sourceName,
    f.sourceUrl,
    f.notes,
  ];
}

/** One Member State's published values, optionally for a single cycle. */
export async function countryDataset(iso2: string, reportingYear?: number): Promise<string> {
  const facts = await getPublishedFacts(reportingYear);
  const rows = facts
    .filter((f) => f.countryIso2 === iso2.toUpperCase())
    .sort((a, b) => a.indicatorCode.localeCompare(b.indicatorCode))
    .map(valueRow);
  return toCsv(VALUE_HEADERS, rows);
}

/** Every published value across the continent. */
export async function continentalDataset(reportingYear?: number): Promise<string> {
  const facts = await getPublishedFacts(reportingYear);
  const rows = facts
    .sort(
      (a, b) =>
        a.countryName.localeCompare(b.countryName) ||
        a.indicatorCode.localeCompare(b.indicatorCode),
    )
    .map(valueRow);
  return toCsv(VALUE_HEADERS, rows);
}
