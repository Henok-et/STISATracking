'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslations } from 'next-intl';

/**
 * Chart components.
 *
 * These render only — they never compute. Every value arrives already
 * aggregated by src/lib/analytics, so no business rule lives in a visual
 * component and the same numbers back the charts, the tables and the exports.
 *
 * Colours come from the --chart-* design tokens so both themes stay consistent
 * and accessible.
 */

const AXIS = {
  stroke: 'var(--color-muted-foreground)',
  fontSize: 12,
};

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--color-popover)',
  border: '1px solid var(--color-border)',
  borderRadius: '0.5rem',
  color: 'var(--color-popover-foreground)',
  fontSize: '0.8125rem',
  padding: '0.5rem 0.75rem',
  boxShadow: '0 8px 24px oklch(0 0 0 / 12%)',
};


function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : String(v);
}

// ---------------------------------------------------------------------------

export interface RegionalDatum {
  region: string;
  completeness: number | null;
  progress: number | null;
  countriesReporting: number;
  countriesTotal: number;
}

/**
 * Regional comparison as grouped bars.
 *
 * A bar chart rather than a pie: the task is comparing five regions against
 * each other, which position on a common scale supports and angle does not.
 */
/**
 * Two-line axis tick: the region, and beneath it how many Member States its
 * average rests on. The denominator travels with the figure here exactly as it
 * does everywhere else on the platform — a bar built from 3 countries and one
 * built from 8 must not look equally solid.
 */
function RegionTick(props: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  counts?: Record<string, string>;
}) {
  const { x = 0, y = 0, payload, counts = {} } = props;
  const label = payload?.value ?? '';
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={12} textAnchor="middle" fill="var(--color-muted-foreground)" fontSize={12}>
        {label}
      </text>
      <text dy={27} textAnchor="middle" fill="var(--color-muted-foreground)" fontSize={10}>
        {counts[label] ?? ''}
      </text>
    </g>
  );
}

export function RegionalComparisonChart({ data }: { data: RegionalDatum[] }) {
  const t = useTranslations('chart');
  const counts = Object.fromEntries(
    data.map((d) => [d.region, `${d.countriesReporting} of ${d.countriesTotal}`]),
  );

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 20, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="region"
          tick={<RegionTick counts={counts} />}
          tickLine={false}
          axisLine={false}
          interval={0}
          height={44}
        />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
          formatter={(value: unknown, name: unknown) => [fmt(value), String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar
          dataKey="completeness"
          name={t('completeness')}
          fill="var(--color-chart-1)"
          radius={[4, 4, 0, 0]}
          maxBarSize={38}
        />
        <Bar
          dataKey="progress"
          name={t('progress')}
          fill="var(--color-chart-2)"
          radius={[4, 4, 0, 0]}
          maxBarSize={38}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

export interface TrendDatum {
  year: string;
  completeness: number | null;
  progress: number | null;
  countriesReporting: number;
}

/** 2026 → 2028 → 2030 → 2033. Gaps stay gaps: nulls are not bridged. */
export function TrendChart({ data }: { data: TrendDatum[] }) {
  const t = useTranslations('chart');
  const tDash = useTranslations('dashboard.trend');

  if (data.length === 0) {
    return (
      <div className="text-muted-foreground grid h-[260px] place-items-center px-6 text-center text-sm">
        {tDash('empty')}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="year" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value: unknown, name: unknown) => [fmt(value), String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="completeness"
          name={t('completeness')}
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          dot={{ r: 4 }}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="progress"
          name={t('progress')}
          stroke="var(--color-chart-2)"
          strokeWidth={2}
          dot={{ r: 4 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
