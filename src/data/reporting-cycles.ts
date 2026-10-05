/**
 * The official STISA 2034 reporting schedule.
 *
 * Phase 1 — implementation 2025-2029 — reports in 2026 and 2028
 * Phase 2 — implementation 2030-2034 — reports in 2030 and 2033
 *
 * Any year without a cycle row is a CLOSED year. This is the only place the
 * schedule is expressed; nothing else in the application hard-codes a year.
 * Administrators can amend windows through /admin/reporting-cycles.
 */

export type CyclePhaseSeed = 'PHASE_1' | 'PHASE_2';

export interface ReportingCycleSeed {
  phase: CyclePhaseSeed;
  implementationStartYear: number;
  implementationEndYear: number;
  reportingYear: number;
  /** Reporting window opens at 00:00 UTC on 1 January of the reporting year. */
  opensAt: Date;
  /** Reporting window closes at 23:59:59 UTC on 31 December of the reporting year. */
  closesAt: Date;
  label: string;
}

const jan1 = (y: number) => new Date(Date.UTC(y, 0, 1, 0, 0, 0));
const dec31 = (y: number) => new Date(Date.UTC(y, 11, 31, 23, 59, 59));

export const REPORTING_CYCLES: ReportingCycleSeed[] = [
  {
    phase: 'PHASE_1',
    implementationStartYear: 2025,
    implementationEndYear: 2029,
    reportingYear: 2026,
    opensAt: jan1(2026),
    closesAt: dec31(2026),
    label: '2026 Reporting Cycle',
  },
  {
    phase: 'PHASE_1',
    implementationStartYear: 2025,
    implementationEndYear: 2029,
    reportingYear: 2028,
    opensAt: jan1(2028),
    closesAt: dec31(2028),
    label: '2028 Reporting Cycle',
  },
  {
    phase: 'PHASE_2',
    implementationStartYear: 2030,
    implementationEndYear: 2034,
    reportingYear: 2030,
    opensAt: jan1(2030),
    closesAt: dec31(2030),
    label: '2030 Reporting Cycle',
  },
  {
    phase: 'PHASE_2',
    implementationStartYear: 2030,
    implementationEndYear: 2034,
    reportingYear: 2033,
    opensAt: jan1(2033),
    closesAt: dec31(2033),
    label: '2033 Reporting Cycle',
  },
];

/** Full strategy span, used to render the closed/open year timeline in the UI. */
export const STRATEGY_START_YEAR = 2025;
export const STRATEGY_END_YEAR = 2034;

export const OFFICIAL_REPORTING_YEARS = REPORTING_CYCLES.map((c) => c.reportingYear);

export function phaseLabel(phase: CyclePhaseSeed): string {
  return phase === 'PHASE_1' ? 'Phase 1 — 2025–2029' : 'Phase 2 — 2030–2034';
}
