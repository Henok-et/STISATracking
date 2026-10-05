import 'server-only';

import { cache } from 'react';
import { prisma } from '@/lib/db';
import { calculateProgress } from './progress';
import { meanOfValid, completeness, round2, type Aggregate } from './aggregate';
import type { SubmissionStatus } from '@/generated/prisma/enums';

/**
 * The analytics layer.
 *
 * Every public figure on the platform is computed here, never inside a React
 * component. Two rules are enforced throughout:
 *
 *   1. Only PUBLISHED submissions may enter public analytics.
 *   2. Missing values are excluded from denominators, never counted as zero.
 *      Every returned aggregate carries the denominator it used.
 *
 * Queries fetch one flat result set per cycle (55 countries x 75 indicators is
 * a few thousand rows) and aggregate in memory, rather than issuing a query per
 * country or per indicator.
 */

const PUBLIC_STATUS: SubmissionStatus = 'PUBLISHED';

function toNum(d: unknown): number | null {
  if (d === null || d === undefined) return null;
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Base fact table
// ---------------------------------------------------------------------------

export interface ValueFact {
  countryId: string;
  countryIso2: string;
  countryName: string;
  regionId: string;
  regionName: string;
  regionCode: string;
  reportingYear: number;
  indicatorId: string;
  indicatorCode: string;
  indicatorName: string;
  sectorId: string;
  sectorCode: string;
  sectorName: string;
  resultLevel: string;
  dataType: string;
  unit: string;
  baseline: number | null;
  target: number | null;
  actual: number | null;
  booleanValue: boolean | null;
  textValue: string | null;
  currencyCode: string | null;
  notes: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  validationStatus: string;
  dataAvailable: boolean;
  /** Target progress, or null where the indicator cannot be scored. */
  progressPct: number | null;
  progressExplanation: string;
  /** Key into the `progressNote` messages. Names the formula that produced the score. */
  progressNarrative: string;
}

/**
 * All published indicator values, optionally narrowed to one reporting year.
 * Cached per-request so several dashboard panels share one database round trip.
 */
export const getPublishedFacts = cache(async (reportingYear?: number): Promise<ValueFact[]> => {
  const rows = await prisma.submissionValue.findMany({
    where: {
      submission: {
        status: PUBLIC_STATUS,
        ...(reportingYear ? { reportingCycle: { reportingYear } } : {}),
      },
    },
    select: {
      dataAvailable: true,
      baselineValue: true,
      targetValue: true,
      actualValue: true,
      booleanValue: true,
      textValue: true,
      currencyCode: true,
      notes: true,
      sourceName: true,
      sourceUrl: true,
      validationStatus: true,
      submission: {
        select: {
          reportingCycle: { select: { reportingYear: true } },
          country: {
            select: {
              id: true,
              iso2: true,
              shortName: true,
              region: { select: { id: true, name: true, code: true } },
            },
          },
        },
      },
      indicator: {
        select: {
          id: true,
          code: true,
          officialName: true,
          dataType: true,
          unit: true,
          calculationMethod: true,
          direction: true,
          sector: { select: { id: true, code: true, name: true, resultLevel: true } },
        },
      },
    },
  });

  return rows.map((r) => {
    const baseline = toNum(r.baselineValue);
    const target = toNum(r.targetValue);
    const actual = toNum(r.actualValue);

    const progress = calculateProgress({
      calculationMethod: r.indicator.calculationMethod,
      direction: r.indicator.direction,
      dataType: r.indicator.dataType,
      baseline,
      target,
      actual,
      booleanValue: r.booleanValue,
    });

    return {
      countryId: r.submission.country.id,
      countryIso2: r.submission.country.iso2,
      countryName: r.submission.country.shortName,
      regionId: r.submission.country.region.id,
      regionName: r.submission.country.region.name,
      regionCode: r.submission.country.region.code,
      reportingYear: r.submission.reportingCycle.reportingYear,
      indicatorId: r.indicator.id,
      indicatorCode: r.indicator.code,
      indicatorName: r.indicator.officialName,
      sectorId: r.indicator.sector.id,
      sectorCode: r.indicator.sector.code,
      sectorName: r.indicator.sector.name,
      resultLevel: r.indicator.sector.resultLevel,
      dataType: r.indicator.dataType,
      unit: r.indicator.unit,
      baseline,
      target,
      actual,
      booleanValue: r.booleanValue,
      textValue: r.textValue,
      currencyCode: r.currencyCode,
      notes: r.notes,
      sourceName: r.sourceName,
      sourceUrl: r.sourceUrl,
      validationStatus: r.validationStatus,
      dataAvailable: r.dataAvailable,
      progressPct: progress.scored ? progress.percent : null,
      progressExplanation: progress.explanation,
      progressNarrative: progress.narrative,
    };
  });
});

// ---------------------------------------------------------------------------
// Continental
// ---------------------------------------------------------------------------

export interface ContinentalOverview {
  reportingYear: number | null;
  cycleLabel: string | null;
  totalCountries: number;
  countriesReporting: number;
  publishedReports: number;
  expectedIndicators: number;
  dataCompleteness: Aggregate;
  targetProgress: Aggregate;
  /** Indicators that exist but which the engine refuses to score. */
  unscoredIndicators: number;
  totalIndicators: number;
}

export const getContinentalOverview = cache(
  async (reportingYear?: number): Promise<ContinentalOverview> => {
    const cycle = reportingYear
      ? await prisma.reportingCycle.findUnique({ where: { reportingYear } })
      : await mostRecentPublishedCycle();

    const [totalCountries, totalIndicators, requiredIndicators] = await Promise.all([
      prisma.country.count({ where: { active: true } }),
      prisma.indicator.count({ where: { active: true } }),
      prisma.indicator.count({ where: { active: true, required: true } }),
    ]);

    if (!cycle) {
      return {
        reportingYear: null,
        cycleLabel: null,
        totalCountries,
        countriesReporting: 0,
        publishedReports: 0,
        expectedIndicators: requiredIndicators * totalCountries,
        dataCompleteness: completeness(0, requiredIndicators * totalCountries),
        targetProgress: meanOfValid([], { unit: 'reported values', kind: 'progress' }),
        unscoredIndicators: 0,
        totalIndicators,
      };
    }

    const facts = await getPublishedFacts(cycle.reportingYear);

    const reportingCountryIds = new Set(
      facts.filter((f) => f.validationStatus === 'REPORTED').map((f) => f.countryId),
    );

    const publishedReports = await prisma.submission.count({
      where: { status: PUBLIC_STATUS, reportingCycleId: cycle.id },
    });

    const validValues = facts.filter((f) => f.validationStatus === 'REPORTED').length;
    const expectedIndicators = requiredIndicators * publishedReports;

    const progressValues = facts
      .filter((f) => f.validationStatus === 'REPORTED')
      .map((f) => f.progressPct);
    const unscored = progressValues.filter((p) => p === null).length;

    return {
      reportingYear: cycle.reportingYear,
      cycleLabel: cycle.label,
      totalCountries,
      countriesReporting: reportingCountryIds.size,
      publishedReports,
      expectedIndicators,
      dataCompleteness: completeness(validValues, expectedIndicators),
      targetProgress: meanOfValid(progressValues, { unit: 'reported values', kind: 'progress' }),
      unscoredIndicators: unscored,
      totalIndicators,
    };
  },
);

/**
 * Resolves the reporting year a query should be framed on.
 *
 * Without this, a caller that passes no year gets facts from EVERY cycle at
 * once: a Member State published in both 2026 and 2028 then contributes two
 * sets of values to the numerator while counting once in the denominator, and
 * completeness climbs above 100%. Panels that show a single cycle must all
 * resolve to the same one — the most recent published cycle — so the dashboard
 * reads as one coherent frame.
 *
 * `getHistoricalTrend` deliberately does not use this: spanning cycles is its
 * whole purpose.
 */
const resolveReportingYear = cache(async (reportingYear?: number): Promise<number | undefined> => {
  if (reportingYear) return reportingYear;
  const cycle = await mostRecentPublishedCycle();
  return cycle?.reportingYear;
});

async function mostRecentPublishedCycle() {
  const submission = await prisma.submission.findFirst({
    where: { status: PUBLIC_STATUS },
    orderBy: { reportingCycle: { reportingYear: 'desc' } },
    include: { reportingCycle: true },
  });
  if (submission) return submission.reportingCycle;
  // Nothing published yet — fall back to the open cycle so the UI has a frame.
  return prisma.reportingCycle.findFirst({
    where: { status: 'OPEN' },
    orderBy: { reportingYear: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Regional
// ---------------------------------------------------------------------------

export interface RegionPerformance {
  regionCode: string;
  regionName: string;
  countriesTotal: number;
  countriesReporting: number;
  completeness: Aggregate;
  targetProgress: Aggregate;
}

export const getRegionalPerformance = cache(
  async (requestedYear?: number): Promise<RegionPerformance[]> => {
    const reportingYear = await resolveReportingYear(requestedYear);
    const [regions, countries, requiredIndicators, facts] = await Promise.all([
      prisma.region.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.country.findMany({ where: { active: true }, select: { id: true, regionId: true } }),
      prisma.indicator.count({ where: { active: true, required: true } }),
      getPublishedFacts(reportingYear),
    ]);

    const countriesByRegion = new Map<string, string[]>();
    for (const c of countries) {
      const list = countriesByRegion.get(c.regionId) ?? [];
      list.push(c.id);
      countriesByRegion.set(c.regionId, list);
    }

    return regions.map((region) => {
      const regionFacts = facts.filter((f) => f.regionId === region.id);
      const reported = regionFacts.filter((f) => f.validationStatus === 'REPORTED');
      const reportingCountries = new Set(reported.map((f) => f.countryId));
      const countriesTotal = countriesByRegion.get(region.id)?.length ?? 0;

      return {
        regionCode: region.code,
        regionName: region.name,
        countriesTotal,
        countriesReporting: reportingCountries.size,
        completeness: completeness(reported.length, requiredIndicators * reportingCountries.size),
        targetProgress: meanOfValid(
          reported.map((f) => f.progressPct),
          { unit: 'reported values', kind: 'progress' },
        ),
      };
    });
  },
);

// ---------------------------------------------------------------------------
// Sectors
// ---------------------------------------------------------------------------

export interface SectorPerformance {
  sectorId: string;
  sectorCode: string;
  sectorName: string;
  subtitle: string | null;
  resultLevel: string;
  /** Verbatim result statement from the MEAL Plan; null where it states none. */
  resultStatement: string | null;
  indicatorCount: number;
  reportedValues: number;
  countriesReporting: number;
  completeness: Aggregate;
  targetProgress: Aggregate;
}

export const getSectorPerformance = cache(
  async (requestedYear?: number): Promise<SectorPerformance[]> => {
    const reportingYear = await resolveReportingYear(requestedYear);
    const [sectors, facts, publishedCount] = await Promise.all([
      prisma.sector.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { indicators: { where: { active: true } } } } },
      }),
      getPublishedFacts(reportingYear),
      prisma.submission.count({
        where: {
          status: PUBLIC_STATUS,
          ...(reportingYear ? { reportingCycle: { reportingYear } } : {}),
        },
      }),
    ]);

    return sectors.map((sector) => {
      const sectorFacts = facts.filter((f) => f.sectorId === sector.id);
      const reported = sectorFacts.filter((f) => f.validationStatus === 'REPORTED');
      const indicatorCount = sector._count.indicators;

      return {
        sectorId: sector.id,
        sectorCode: sector.code,
        sectorName: sector.name,
        subtitle: sector.subtitle,
        resultLevel: sector.resultLevel,
        resultStatement: sector.resultStatement,
        indicatorCount,
        reportedValues: reported.length,
        countriesReporting: new Set(reported.map((f) => f.countryId)).size,
        completeness: completeness(reported.length, indicatorCount * publishedCount),
        targetProgress: meanOfValid(
          reported.map((f) => f.progressPct),
          { unit: 'reported values', kind: 'progress' },
        ),
      };
    });
  },
);

// ---------------------------------------------------------------------------
// Country leaderboard & heatmap
// ---------------------------------------------------------------------------

export interface CountryRow {
  countryId: string;
  iso2: string;
  name: string;
  regionName: string;
  regionCode: string;
  status: SubmissionStatus | 'NOT_STARTED';
  completeness: Aggregate;
  targetProgress: Aggregate;
}

export const getCountryLeaderboard = cache(
  async (requestedYear?: number): Promise<CountryRow[]> => {
    const reportingYear = await resolveReportingYear(requestedYear);
    const [countries, requiredIndicators, facts, submissions] = await Promise.all([
      prisma.country.findMany({
        where: { active: true },
        include: { region: true },
        orderBy: { shortName: 'asc' },
      }),
      prisma.indicator.count({ where: { active: true, required: true } }),
      getPublishedFacts(reportingYear),
      prisma.submission.findMany({
        where: {
          status: PUBLIC_STATUS,
          ...(reportingYear ? { reportingCycle: { reportingYear } } : {}),
        },
        select: { countryId: true, status: true },
      }),
    ]);

    const statusByCountry = new Map(submissions.map((s) => [s.countryId, s.status]));
    const factsByCountry = new Map<string, ValueFact[]>();
    for (const f of facts) {
      const list = factsByCountry.get(f.countryId) ?? [];
      list.push(f);
      factsByCountry.set(f.countryId, list);
    }

    return countries.map((c) => {
      const own = factsByCountry.get(c.id) ?? [];
      const reported = own.filter((f) => f.validationStatus === 'REPORTED');
      return {
        countryId: c.id,
        iso2: c.iso2,
        name: c.shortName,
        regionName: c.region.name,
        regionCode: c.region.code,
        status: statusByCountry.get(c.id) ?? 'NOT_STARTED',
        completeness: completeness(reported.length, requiredIndicators),
        targetProgress: meanOfValid(
          reported.map((f) => f.progressPct),
          { unit: 'reported indicators', kind: 'progress' },
        ),
      };
    });
  },
);

export interface HeatmapCell {
  countryIso2: string;
  sectorCode: string;
  /** Null means the country reported nothing for this sector. */
  completenessPct: number | null;
  reported: number;
  expected: number;
}

export interface Heatmap {
  countries: { iso2: string; name: string; regionCode: string }[];
  sectors: { code: string; name: string; indicatorCount: number }[];
  cells: HeatmapCell[];
}

export const getCountrySectorHeatmap = cache(async (requestedYear?: number): Promise<Heatmap> => {
  const reportingYear = await resolveReportingYear(requestedYear);
  const [countries, sectors, facts] = await Promise.all([
    prisma.country.findMany({
      where: { active: true },
      include: { region: true },
      orderBy: { shortName: 'asc' },
    }),
    prisma.sector.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { indicators: { where: { active: true, required: true } } } } },
    }),
    getPublishedFacts(reportingYear),
  ]);

  const key = (countryId: string, sectorId: string) => `${countryId}::${sectorId}`;
  const reportedCounts = new Map<string, number>();
  for (const f of facts) {
    if (f.validationStatus !== 'REPORTED') continue;
    const k = key(f.countryId, f.sectorId);
    reportedCounts.set(k, (reportedCounts.get(k) ?? 0) + 1);
  }

  const cells: HeatmapCell[] = [];
  for (const c of countries) {
    for (const s of sectors) {
      const expected = s._count.indicators;
      const reported = reportedCounts.get(key(c.id, s.id)) ?? 0;
      cells.push({
        countryIso2: c.iso2,
        sectorCode: s.code,
        // Distinguishes "reported 0%" from "did not report at all".
        completenessPct: reported === 0 ? null : round2((reported / expected) * 100),
        reported,
        expected,
      });
    }
  }

  return {
    countries: countries.map((c) => ({
      iso2: c.iso2,
      name: c.shortName,
      regionCode: c.region.code,
    })),
    sectors: sectors.map((s) => ({
      code: s.code,
      name: s.name,
      indicatorCount: s._count.indicators,
    })),
    cells,
  };
});

// ---------------------------------------------------------------------------
// Historical trend
// ---------------------------------------------------------------------------

export interface TrendPoint {
  reportingYear: number;
  cycleLabel: string;
  countriesReporting: number;
  completenessPct: number | null;
  targetProgressPct: number | null;
  basis: string;
}

/** 2026 → 2028 → 2030 → 2033, restricted to cycles with published data. */
export const getHistoricalTrend = cache(async (countryIso2?: string): Promise<TrendPoint[]> => {
  const [cycles, requiredIndicators] = await Promise.all([
    prisma.reportingCycle.findMany({ orderBy: { reportingYear: 'asc' } }),
    prisma.indicator.count({ where: { active: true, required: true } }),
  ]);

  const allFacts = await getPublishedFacts();
  const scoped = countryIso2
    ? allFacts.filter((f) => f.countryIso2 === countryIso2)
    : allFacts;

  const points: TrendPoint[] = [];
  for (const cycle of cycles) {
    const yearFacts = scoped.filter((f) => f.reportingYear === cycle.reportingYear);
    const reported = yearFacts.filter((f) => f.validationStatus === 'REPORTED');
    const countries = new Set(reported.map((f) => f.countryId));

    // Only emit points that have published data — an empty 2030 point would
    // read as a collapse rather than as "not yet reported".
    if (reported.length === 0) continue;

    const expected = requiredIndicators * (countryIso2 ? 1 : countries.size);
    const progress = meanOfValid(reported.map((f) => f.progressPct), {
      unit: 'reported values',
      kind: 'progress',
    });

    points.push({
      reportingYear: cycle.reportingYear,
      cycleLabel: cycle.label,
      countriesReporting: countries.size,
      completenessPct: expected === 0 ? null : round2((reported.length / expected) * 100),
      targetProgressPct: progress.value,
      basis: progress.basis,
    });
  }

  return points;
});

// ---------------------------------------------------------------------------
// Country profile
// ---------------------------------------------------------------------------

export interface CountryProfile {
  country: {
    id: string;
    iso2: string;
    iso3: string;
    name: string;
    shortName: string;
    regionName: string;
    regionCode: string;
  };
  availableCycles: { reportingYear: number; label: string; publishedAt: Date | null }[];
  selectedYear: number | null;
  status: SubmissionStatus | 'NOT_STARTED';
  completeness: Aggregate;
  targetProgress: Aggregate;
  sectors: {
    sectorCode: string;
    sectorName: string;
    subtitle: string | null;
    resultLevel: string;
    reported: number;
    expected: number;
    targetProgress: Aggregate;
  }[];
  indicators: ValueFact[];
  trend: TrendPoint[];
}

export const getCountryProfile = cache(
  async (iso2: string, reportingYear?: number): Promise<CountryProfile | null> => {
    const country = await prisma.country.findUnique({
      where: { iso2: iso2.toUpperCase() },
      include: { region: true },
    });
    if (!country || !country.active) return null;

    const publishedSubmissions = await prisma.submission.findMany({
      where: { countryId: country.id, status: PUBLIC_STATUS },
      include: { reportingCycle: true },
      orderBy: { reportingCycle: { reportingYear: 'desc' } },
    });

    const availableCycles = publishedSubmissions.map((s) => ({
      reportingYear: s.reportingCycle.reportingYear,
      label: s.reportingCycle.label,
      publishedAt: s.publishedAt,
    }));

    const selectedYear =
      reportingYear && availableCycles.some((c) => c.reportingYear === reportingYear)
        ? reportingYear
        : (availableCycles[0]?.reportingYear ?? null);

    const [sectors, requiredIndicators, allFacts, trend] = await Promise.all([
      prisma.sector.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { indicators: { where: { active: true, required: true } } } } },
      }),
      prisma.indicator.count({ where: { active: true, required: true } }),
      selectedYear ? getPublishedFacts(selectedYear) : Promise.resolve([] as ValueFact[]),
      getHistoricalTrend(country.iso2),
    ]);

    const facts = allFacts.filter((f) => f.countryId === country.id);
    const reported = facts.filter((f) => f.validationStatus === 'REPORTED');

    const selectedSubmission = publishedSubmissions.find(
      (s) => s.reportingCycle.reportingYear === selectedYear,
    );

    return {
      country: {
        id: country.id,
        iso2: country.iso2,
        iso3: country.iso3,
        name: country.name,
        shortName: country.shortName,
        regionName: country.region.name,
        regionCode: country.region.code,
      },
      availableCycles,
      selectedYear,
      status: selectedSubmission?.status ?? 'NOT_STARTED',
      completeness: completeness(reported.length, requiredIndicators),
      targetProgress: meanOfValid(reported.map((f) => f.progressPct), {
        unit: 'reported indicators',
        kind: 'progress',
      }),
      sectors: sectors.map((s) => {
        const own = reported.filter((f) => f.sectorCode === s.code);
        return {
          sectorCode: s.code,
          sectorName: s.name,
          subtitle: s.subtitle,
          resultLevel: s.resultLevel,
          reported: own.length,
          expected: s._count.indicators,
          targetProgress: meanOfValid(own.map((f) => f.progressPct), {
            unit: 'reported indicators',
            kind: 'progress',
          }),
        };
      }),
      indicators: facts,
      trend,
    };
  },
);

// ---------------------------------------------------------------------------
// Sector detail
// ---------------------------------------------------------------------------

export interface SectorDetail {
  sector: {
    id: string;
    code: string;
    name: string;
    subtitle: string | null;
    resultLevel: string;
    resultStatement: string | null;
  };
  indicators: {
    id: string;
    code: string;
    officialName: string;
    sourceText: string;
    unit: string;
    dataType: string;
    calculationMethod: string;
    direction: string;
    flags: string[];
    ambiguityNote: string | null;
    countriesReporting: number;
    targetProgress: Aggregate;
    /**
     * One score per Member State that could be scored, in no particular order.
     * The mean of these is `targetProgress.value`; the list lets the UI show
     * the spread behind that mean instead of a single bar.
     */
    scores: number[];
  }[];
  continental: {
    completeness: Aggregate;
    targetProgress: Aggregate;
    countriesReporting: number;
    /** Everything needed to show a reader how each figure was arrived at. */
    breakdown: {
      indicatorsInSector: number;
      countriesReporting: number;
      expectedValues: number;
      reportedValues: number;
      notReported: number;
      notApplicable: number;
      /** Reported values the engine refused to score, and why they exist. */
      unscored: number;
      scored: number;
    };
  };
  regions: RegionPerformance[];
  countries: { iso2: string; name: string; regionName: string; reported: number; expected: number; targetProgress: Aggregate }[];
  trend: TrendPoint[];
  selectedYear: number | null;
}

export const getSectorDetail = cache(
  async (sectorCode: string, reportingYear?: number): Promise<SectorDetail | null> => {
    const sector = await prisma.sector.findUnique({
      where: { code: sectorCode.toUpperCase() },
      include: {
        indicators: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!sector || !sector.active) return null;

    const overview = await getContinentalOverview(reportingYear);
    const year = reportingYear ?? overview.reportingYear ?? undefined;

    const [allFacts, countries, regionRows, trend] = await Promise.all([
      getPublishedFacts(year),
      prisma.country.findMany({
        where: { active: true },
        include: { region: true },
        orderBy: { shortName: 'asc' },
      }),
      getRegionalPerformance(year),
      getHistoricalTrend(),
    ]);

    const facts = allFacts.filter((f) => f.sectorId === sector.id);
    const reported = facts.filter((f) => f.validationStatus === 'REPORTED');
    const expectedPerCountry = sector.indicators.filter((i) => i.required).length;
    const reportingCountryCount = new Set(reported.map((f) => f.countryId)).size;

    // Restrict the regional panel to this sector's values.
    const regions: RegionPerformance[] = regionRows.map((r) => {
      const own = reported.filter((f) => f.regionCode === r.regionCode);
      const reportingCountries = new Set(own.map((f) => f.countryId));
      return {
        ...r,
        countriesReporting: reportingCountries.size,
        completeness: completeness(own.length, expectedPerCountry * reportingCountries.size),
        targetProgress: meanOfValid(own.map((f) => f.progressPct), {
          unit: 'reported values',
          kind: 'progress',
        }),
      };
    });

    return {
      sector: {
        id: sector.id,
        code: sector.code,
        name: sector.name,
        subtitle: sector.subtitle,
        resultLevel: sector.resultLevel,
        resultStatement: sector.resultStatement,
      },
      indicators: sector.indicators.map((i) => {
        const own = reported.filter((f) => f.indicatorId === i.id);
        return {
          id: i.id,
          code: i.code,
          officialName: i.officialName,
          sourceText: i.sourceText,
          unit: i.unit,
          dataType: i.dataType,
          calculationMethod: i.calculationMethod,
          direction: i.direction,
          flags: i.flags,
          ambiguityNote: i.ambiguityNote,
          countriesReporting: new Set(own.map((f) => f.countryId)).size,
          targetProgress: meanOfValid(own.map((f) => f.progressPct), { unit: 'Member States', kind: 'progress' }),
          scores: own.map((f) => f.progressPct).filter((p): p is number => p !== null),
        };
      }),
      continental: {
        completeness: completeness(reported.length, expectedPerCountry * reportingCountryCount),
        targetProgress: meanOfValid(reported.map((f) => f.progressPct), {
          unit: 'reported values',
          kind: 'progress',
        }),
        countriesReporting: reportingCountryCount,
        breakdown: {
          indicatorsInSector: expectedPerCountry,
          countriesReporting: reportingCountryCount,
          expectedValues: expectedPerCountry * reportingCountryCount,
          reportedValues: reported.length,
          notReported: facts.filter((f) => f.validationStatus === 'NOT_REPORTED').length,
          notApplicable: facts.filter((f) => f.validationStatus === 'NOT_APPLICABLE').length,
          unscored: reported.filter((f) => f.progressPct === null).length,
          scored: reported.filter((f) => f.progressPct !== null).length,
        },
      },
      regions,
      countries: countries.map((c) => {
        const own = reported.filter((f) => f.countryId === c.id);
        return {
          iso2: c.iso2,
          name: c.shortName,
          regionName: c.region.name,
          reported: own.length,
          expected: expectedPerCountry,
          targetProgress: meanOfValid(own.map((f) => f.progressPct), { unit: 'reported indicators', kind: 'progress' }),
        };
      }),
      trend,
      selectedYear: year ?? null,
    };
  },
);
