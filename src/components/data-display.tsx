import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Check, Info, MinusCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BasisHint } from '@/components/basis-hint';
import type { Aggregate } from '@/lib/analytics/aggregate';
import type { ProgressNarrative } from '@/lib/analytics/progress';
import type { SubmissionStatus } from '@/generated/prisma/enums';

/**
 * Shared display primitives.
 *
 * The recurring requirement across the platform: never show a figure without
 * showing what it was computed over. Every aggregate renders its short basis
 * inline and its full sentence behind `BasisHint`, so the denominator is
 * always on screen and the explanation is always one hover away.
 *
 * Two metrics, two colours, everywhere: completeness is `--chart-1`, target
 * progress is `--chart-2`. The KPI cards, the lists and the tables share them
 * so a reader learns the pairing once.
 */

/** The sentence under a figure: what was averaged, what was left out, and why. */
export function DataBasis({ basis, className }: { basis: string; className?: string }) {
  return (
    <p className={cn('text-muted-foreground text-xs leading-relaxed', className)}>{basis}</p>
  );
}

/** Renders a missing value explicitly rather than as 0. */
export function NoData({ label }: { label?: string }) {
  const t = useTranslations('common');
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
      <MinusCircle className="size-3.5" aria-hidden />
      {label ?? t('notReported')}
    </span>
  );
}

export function StatCard({
  label,
  value,
  suffix,
  aggregate,
  hint,
  footer,
  icon,
  tone = 'default',
  className,
}: {
  label: string;
  value: number | string | null;
  suffix?: string;
  aggregate?: Aggregate;
  hint?: string;
  /** Optional trailing element, typically a "How is this calculated?" link. */
  footer?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'primary' | 'accent';
  className?: string;
}) {
  const hasValue = value !== null && value !== undefined && value !== '';

  return (
    <Card
      className={cn(
        'h-full transition-shadow hover:shadow-md',
        tone === 'primary' && 'border-t-2 border-t-primary',
        tone === 'accent' && 'border-t-2 border-t-accent',
        className,
      )}
    >
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-muted-foreground text-sm font-medium">{label}</p>
          {icon ? (
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-md',
                tone === 'primary' && 'bg-primary/15 text-primary',
                tone === 'accent' && 'bg-accent/20 text-accent-foreground',
                tone === 'default' && 'bg-muted text-muted-foreground',
              )}
              aria-hidden
            >
              {icon}
            </span>
          ) : null}
        </div>

        <div className="flex items-baseline gap-1">
          {hasValue ? (
            <>
              <span className="stat-value">{value}</span>
              {suffix ? (
                <span className="text-muted-foreground text-lg font-medium">{suffix}</span>
              ) : null}
            </>
          ) : (
            <NoData />
          )}
        </div>

        <div className="mt-auto space-y-1">
          {aggregate ? (
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              <span className="tnum">{aggregate.basisShort}</span>
              <BasisHint text={aggregate.basis} />
            </p>
          ) : null}
          {hint ? <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p> : null}
          {footer}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Horizontal meter. A null value renders an explicit "not reported" track
 * rather than an empty bar, which would read as zero.
 */
export type MeterTone = 'primary' | 'accent' | 'success' | 'completeness' | 'progress';

const METER_FILL: Record<MeterTone, string> = {
  primary: 'grad-progress',
  accent: 'bg-accent',
  success: 'bg-success',
  completeness: 'bg-[var(--color-chart-1)]',
  progress: 'bg-[var(--color-chart-2)]',
};

export function Meter({
  value,
  label,
  emptyLabel,
  className,
  tone = 'primary',
}: {
  value: number | null;
  label?: string;
  /** What to print under an empty track. Pass `null` to print nothing. */
  emptyLabel?: string | null;
  className?: string;
  tone?: MeterTone;
}) {
  if (value === null) {
    return (
      <div className={cn('space-y-1', className)}>
        <div className="bg-muted h-2 w-full rounded-full">
          <div className="border-border h-2 w-full rounded-full border border-dashed opacity-60" />
        </div>
        {emptyLabel === null ? null : <NoData label={emptyLabel} />}
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={cn('space-y-1', className)}>
      <div
        className="bg-muted h-2 w-full overflow-hidden rounded-full"
        role="meter"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', METER_FILL[tone])}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {label ? <p className="text-muted-foreground text-xs tnum">{label}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetricRow — the one visual grammar for "completeness and target progress"
// ---------------------------------------------------------------------------

function MetricCell({
  label,
  aggregate,
  tone,
  emptyLabel,
}: {
  label: string;
  aggregate: Aggregate;
  tone: 'completeness' | 'progress';
  emptyLabel: string;
}) {
  const value = aggregate.value;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('tnum font-medium', value === null && 'text-muted-foreground')}>
          {value === null ? emptyLabel : `${pct(value, 0)}%`}
        </span>
      </div>
      <Meter className="mt-1" value={value} tone={tone} emptyLabel={null} />
      <p className="text-muted-foreground mt-1 flex items-center gap-1 text-[0.7rem] leading-none">
        <span className="tnum truncate">{aggregate.basisShort}</span>
        <BasisHint text={aggregate.basis} className="text-muted-foreground hover:text-foreground inline-flex size-4 shrink-0 items-center justify-center rounded-sm" />
      </p>
    </div>
  );
}

/**
 * One row, one entity, both figures: a name, an optional note on the right,
 * and the two meters side by side with their short bases underneath.
 *
 * Used for regions, for the 16 categories and for Member States, so every
 * list on the dashboard reads the same way. Nothing here is computed — the
 * two aggregates arrive with value, denominator and basis already set.
 */
export function MetricRow({
  name,
  href,
  subtitle,
  meta,
  completeness,
  progress,
  className,
}: {
  name: string;
  href?: string;
  subtitle?: string | null;
  meta?: ReactNode;
  completeness: Aggregate;
  progress: Aggregate;
  className?: string;
}) {
  const tChart = useTranslations('chart');
  const tCommon = useTranslations('common');

  return (
    <li className={cn('py-3.5', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        {href ? (
          <Link
            href={href}
            className="hover:text-primary min-w-0 text-sm font-medium leading-snug hover:underline"
          >
            {name}
          </Link>
        ) : (
          <span className="min-w-0 text-sm font-medium leading-snug">{name}</span>
        )}
        {meta ? <span className="text-muted-foreground shrink-0 text-xs tnum">{meta}</span> : null}
      </div>
      {subtitle ? (
        <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{subtitle}</p>
      ) : null}
      <div className="mt-2.5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <MetricCell
          label={tChart('completeness')}
          aggregate={completeness}
          tone="completeness"
          emptyLabel={tCommon('notReported')}
        />
        <MetricCell
          label={tChart('progress')}
          aggregate={progress}
          tone="progress"
          emptyLabel={tCommon('notScored')}
        />
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// TargetTrack — one indicator's distance to its target
// ---------------------------------------------------------------------------

/** Over-achievement is drawn up to this point; beyond it the marker pins and a chip says by how much. */
const TRACK_MAX = 150;

const NO_BASELINE_NARRATIVES = new Set<ProgressNarrative>([
  'LEVEL_NO_BASELINE_HIGHER',
  'LEVEL_NO_BASELINE_LOWER',
  'LEVEL_NO_BASELINE_ASSUMED',
]);

/**
 * Replaces a 0–100 bar for indicator rows.
 *
 * A bar answered "what percentage?" and hid three things the engine is
 * careful about: over-achievement (clamped to look like exactly 100%), a real
 * zero (drawn like missing data) and the inputs behind the score. This track
 * runs from the baseline to the target, puts the reported value on it as a
 * marker, prints the actual numbers with their unit, and lets the marker pass
 * the target when the score is above 100%.
 *
 * With `scores` (the sector page, many Member States per indicator) it draws
 * one small dot per state behind the mean marker so the spread is visible.
 *
 * Marker positions are layout: `percent` is the score the analytics layer
 * already produced, and the track only maps it to a horizontal offset.
 */
export function TargetTrack({
  percent,
  narrative,
  actualLabel,
  baselineLabel,
  targetLabel,
  reason,
  scores,
  className,
}: {
  percent: number | null;
  /** Which formula produced `percent`. Omitted in aggregate mode, where many formulas contributed. */
  narrative?: ProgressNarrative;
  /** Preformatted reported value with unit, e.g. "150 researchers". */
  actualLabel?: string | null;
  baselineLabel?: string | null;
  targetLabel?: string | null;
  /** Translated sentence explaining an unscored result. */
  reason?: string;
  /** Per-Member-State scores behind an averaged `percent`. */
  scores?: number[];
  className?: string;
}) {
  const t = useTranslations('track');
  const tCommon = useTranslations('common');

  if (narrative === 'BINARY_YES' || narrative === 'BINARY_NO') {
    const yes = narrative === 'BINARY_YES';
    return (
      <p className={cn('inline-flex items-center gap-1.5 text-sm', className)}>
        {yes ? (
          <Check className="text-success size-4" aria-hidden />
        ) : (
          <X className="text-muted-foreground size-4" aria-hidden />
        )}
        <span className={yes ? 'font-medium' : 'text-muted-foreground'}>
          {yes ? t('achieved') : t('notAchieved')}
        </span>
      </p>
    );
  }

  if (percent === null) {
    return (
      <div className={cn('space-y-1', className)}>
        <div className="bg-muted h-2 w-full rounded-full">
          <div className="border-border h-2 w-full rounded-full border border-dashed opacity-60" />
        </div>
        <NoData label={tCommon('notScored')} />
        {reason ? (
          <p className="text-muted-foreground text-xs leading-relaxed">{reason}</p>
        ) : null}
      </div>
    );
  }

  const aggregateMode = Array.isArray(scores) && scores.length > 0;
  const shown = Math.min(percent, TRACK_MAX);
  const highest = aggregateMode ? Math.max(shown, ...scores.map((s) => Math.min(s, TRACK_MAX))) : shown;
  // The track spans 0..scale; the target sits at 100 and moves left when a marker passes it.
  const scale = Math.max(100, highest);
  const targetAt = (100 / scale) * 100;
  const markerAt = (shown / scale) * 100;
  const over = percent > 100;
  const pinned = percent > TRACK_MAX;

  const leftLabel = aggregateMode
    ? '0%'
    : baselineLabel
      ? `${t('baseline')} ${baselineLabel}`
      : narrative && NO_BASELINE_NARRATIVES.has(narrative)
        ? t('noBaseline')
        : narrative === 'CHANGE'
          ? t('noChange')
          : t('start');
  const rightLabel = aggregateMode
    ? t('targetMet')
    : targetLabel
      ? `${t('target')} ${targetLabel}`
      : t('targetMet');

  const readout = `${pct(percent, 0)}%`;
  const ariaText = actualLabel ? `${actualLabel}, ${readout} ${t('ofTarget')}` : `${readout} ${t('ofTarget')}`;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="tnum truncate font-medium">{actualLabel ?? readout}</span>
        <span className="tnum text-muted-foreground shrink-0">
          {actualLabel ? readout : null}
          {over ? (
            <span className="bg-accent/20 text-accent-foreground ms-1.5 rounded-sm px-1 py-px font-medium">
              {pinned ? t('overPinned') : t('over', { pct: pct(percent - 100, 0) })}
            </span>
          ) : null}
        </span>
      </div>

      <div
        className="relative h-3"
        role="meter"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={Math.max(100, Math.ceil(percent))}
        aria-valuetext={ariaText}
      >
        {/* base line */}
        <div className="bg-muted absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full" />
        {/* progress up to the target */}
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[var(--color-chart-2)]"
          style={{ left: 0, width: `${Math.min(markerAt, targetAt)}%` }}
        />
        {/* beyond the target */}
        {over ? (
          <div
            className="absolute top-1/2 h-2 -translate-y-1/2 rounded-e-full bg-[var(--color-chart-2)] opacity-45"
            style={{ left: `${targetAt}%`, width: `${markerAt - targetAt}%` }}
          />
        ) : null}
        {/* target tick */}
        <div
          aria-hidden
          className="bg-foreground absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${targetAt}%` }}
        />
        {/* one dot per Member State */}
        {aggregateMode
          ? scores.map((s, i) => (
              <span
                key={i}
                aria-hidden
                title={`${pct(s, 0)}%`}
                className="bg-foreground/60 absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${(Math.min(s, TRACK_MAX) / scale) * 100}%` }}
              />
            ))
          : null}
        {/* the reported value */}
        <span
          aria-hidden
          className={cn(
            'bg-background absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-chart-2)]',
            percent === 0 && 'bg-[var(--color-chart-2)]',
            pinned && 'ring-accent ring-2',
          )}
          style={{ left: `${markerAt}%` }}
        />
      </div>

      <div className="text-muted-foreground flex justify-between gap-2 text-[0.7rem] leading-none">
        <span className="tnum truncate">{leftLabel}</span>
        <span className="tnum truncate text-end">{rightLabel}</span>
      </div>
      {aggregateMode ? (
        <p className="text-muted-foreground text-[0.7rem] leading-none">
          {t('statesBehind', { count: scores.length })}
        </p>
      ) : null}
    </div>
  );
}

const STATUS_TONE: Record<SubmissionStatus | 'NOT_STARTED', string> = {
  NOT_STARTED: 'bg-muted text-muted-foreground border-transparent',
  DRAFT: 'bg-muted text-foreground border-border',
  SUBMITTED: 'bg-info/12 text-info border-info/30',
  UNDER_REVIEW: 'bg-accent/20 text-accent-foreground border-accent/40',
  REVISION_REQUIRED: 'bg-warning/15 text-warning-foreground border-warning/40',
  APPROVED: 'bg-success/12 text-success border-success/30',
  PUBLISHED: 'bg-primary/12 text-primary border-primary/30',
};

export function StatusBadge({
  status,
  className,
}: {
  status: SubmissionStatus | 'NOT_STARTED';
  className?: string;
}) {
  const t = useTranslations('status');
  return (
    <Badge variant="outline" className={cn('font-medium', STATUS_TONE[status], className)}>
      {(status === 'SUBMITTED' || status === 'UNDER_REVIEW') && (
        <span
          className="me-1.5 inline-block size-1.5 animate-pulse rounded-full bg-current"
          aria-hidden
        />
      )}
      {t(status)}
    </Badge>
  );
}

/** Explains a figure the analytics engine deliberately refused to score. */
export function UnscoredNote({ reason }: { reason: string }) {
  return (
    <p className="text-muted-foreground flex items-start gap-1.5 text-xs leading-relaxed">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{reason}</span>
    </p>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function pct(value: number | null, digits = 1): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(digits)}`;
}
