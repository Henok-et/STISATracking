import 'server-only';

import { prisma } from '@/lib/db';
import { STRATEGY_START_YEAR, STRATEGY_END_YEAR } from '@/data/reporting-cycles';
import type { ReportingCycle } from '@/generated/prisma/client';

/**
 * Reporting-window rules.
 *
 * The schedule lives entirely in the ReportingCycle table. Nothing here (or
 * anywhere else in the application) hard-codes 2026/2028/2030/2033 — a year is
 * a reporting year if and only if an open cycle row covers it.
 */

export interface CycleWindow {
  cycle: ReportingCycle;
  isOpen: boolean;
  opensAt: Date;
  closesAt: Date;
}

export function isCycleOpen(cycle: ReportingCycle, now: Date = new Date()): boolean {
  return cycle.status === 'OPEN' && cycle.opensAt <= now && cycle.closesAt >= now;
}

/**
 * The cycle currently accepting data, or null when reporting is closed.
 *
 * Deliberately derived from dates rather than trusting the `active` flag alone,
 * so a stale flag can never open a window that the schedule says is shut.
 */
export async function getOpenCycle(now: Date = new Date()): Promise<ReportingCycle | null> {
  const candidate = await prisma.reportingCycle.findFirst({
    where: { status: 'OPEN', opensAt: { lte: now }, closesAt: { gte: now } },
    orderBy: { reportingYear: 'asc' },
  });
  return candidate ?? null;
}

/** The next cycle that will open, used to tell users when reporting resumes. */
export async function getNextCycle(now: Date = new Date()): Promise<ReportingCycle | null> {
  return prisma.reportingCycle.findFirst({
    where: { opensAt: { gt: now } },
    orderBy: { opensAt: 'asc' },
  });
}

/** Every cycle that has ever closed or is open, newest first — for trend UIs. */
export async function getReportableCycles(now: Date = new Date()): Promise<ReportingCycle[]> {
  return prisma.reportingCycle.findMany({
    where: { opensAt: { lte: now } },
    orderBy: { reportingYear: 'asc' },
  });
}

export async function getAllCycles(): Promise<ReportingCycle[]> {
  return prisma.reportingCycle.findMany({ orderBy: { reportingYear: 'asc' } });
}

export interface ReportingYearStatus {
  year: number;
  isReportingYear: boolean;
  cycle: ReportingCycle | null;
  state: 'OPEN' | 'CLOSED' | 'SCHEDULED' | 'NOT_A_REPORTING_YEAR';
}

/**
 * The full 2025-2034 timeline, marking each year open, closed or not scheduled.
 * Drives the "Reporting is not scheduled for this year" UI.
 */
export async function getStrategyTimeline(now: Date = new Date()): Promise<ReportingYearStatus[]> {
  const cycles = await getAllCycles();
  const byYear = new Map(cycles.map((c) => [c.reportingYear, c]));
  const timeline: ReportingYearStatus[] = [];

  for (let year = STRATEGY_START_YEAR; year <= STRATEGY_END_YEAR; year++) {
    const cycle = byYear.get(year) ?? null;
    let state: ReportingYearStatus['state'] = 'NOT_A_REPORTING_YEAR';
    if (cycle) {
      if (isCycleOpen(cycle, now)) state = 'OPEN';
      else if (cycle.closesAt < now) state = 'CLOSED';
      else state = 'SCHEDULED';
    }
    timeline.push({ year, isReportingYear: cycle !== null, cycle, state });
  }
  return timeline;
}

export interface ReportingAvailability {
  open: boolean;
  cycle: ReportingCycle | null;
  nextCycle: ReportingCycle | null;
  /** Message shown when reporting is closed. */
  reason: string | null;
}

/**
 * Single source of truth for "can a country submit right now?".
 * Called by every data-entry Server Action before any write.
 */
export async function getReportingAvailability(
  now: Date = new Date(),
): Promise<ReportingAvailability> {
  const cycle = await getOpenCycle(now);
  if (cycle) {
    return { open: true, cycle, nextCycle: null, reason: null };
  }

  const nextCycle = await getNextCycle(now);
  const year = now.getUTCFullYear();
  const reason = nextCycle
    ? `Reporting is not scheduled for ${year}. The next reporting cycle opens in ${nextCycle.reportingYear}.`
    : `Reporting is not scheduled for ${year}, and no further reporting cycles are scheduled.`;

  return { open: false, cycle: null, nextCycle, reason };
}
