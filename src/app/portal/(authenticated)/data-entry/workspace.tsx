'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  CloudOff,
  Info,
  Loader2,
  Save,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';

import { saveValues, checkReadiness } from '@/lib/actions/data-entry';
import { transitionSubmission } from '@/lib/actions/workflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Meter } from '@/components/data-display';
import { cn } from '@/lib/utils';
import type { SubmissionStatus, ValueState } from '@/generated/prisma/enums';

/**
 * The reporting workspace.
 *
 * 75 indicators presented as one form would be unusable, so they are grouped by
 * the official MEAL Plan category and each group is collapsible with its own
 * completion count.
 *
 * Persistence rules:
 *   - The database is the authoritative store. Autosave writes to it.
 *   - localStorage holds an unsaved-edits buffer purely as crash recovery; it
 *     is cleared as soon as a save succeeds and is never read in preference to
 *     server data that is newer.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceValue {
  dataAvailable: boolean;
  notApplicable: boolean;
  baselineValue: string;
  targetValue: string;
  actualValue: string;
  booleanValue: boolean | null;
  textValue: string;
  categoricalValue: string;
  baselineYear: number | null;
  currencyCode: string;
  notes: string;
  sourceName: string;
  sourceUrl: string;
  validationStatus: ValueState;
  validationMessages: string[];
}

export interface WorkspaceIndicator {
  id: string;
  code: string;
  officialName: string;
  sourceText: string;
  definition: string | null;
  unit: string;
  dataType: string;
  calculationMethod: string;
  direction: string;
  ambiguityNote: string | null;
  flags: string[];
  required: boolean;
  sourceRequired: boolean;
  value: WorkspaceValue | null;
}

export interface WorkspaceSector {
  code: string;
  name: string;
  subtitle: string | null;
  resultLevel: string;
  indicators: WorkspaceIndicator[];
}

interface ReadinessSummary {
  totals: {
    expected: number;
    reported: number;
    notApplicable: number;
    missing: number;
    invalid: number;
    completenessPct: number;
  };
  checks: { key: string; label: string; passed: boolean; detail: string }[];
  issueCount: number;
}

const EMPTY: WorkspaceValue = {
  dataAvailable: false,
  notApplicable: false,
  baselineValue: '',
  targetValue: '',
  actualValue: '',
  booleanValue: null,
  textValue: '',
  categoricalValue: '',
  baselineYear: null,
  currencyCode: '',
  notes: '',
  sourceName: '',
  sourceUrl: '',
  validationStatus: 'NOT_REPORTED',
  validationMessages: [],
};

const NUMERIC = new Set(['INTEGER', 'DECIMAL', 'PERCENTAGE', 'CURRENCY']);

/** Keys into the `flagsWorkspace` message section. */
const SHOWN_FLAGS = [
  'COMPOUND_STATEMENT',
  'DUPLICATE_OF_ANOTHER_ROW',
  'OVERLAPS_ANOTHER_ROW',
  'REQUIRES_DISAGGREGATION',
  'CONTINENTAL_LEVEL_WORDING',
  'UNIT_NOT_SPECIFIED',
  'AMBIGUOUS_MEASUREMENT_BASIS',
] as const;

type WorkspaceFlag = (typeof SHOWN_FLAGS)[number];

// ---------------------------------------------------------------------------

export function DataEntryWorkspace({
  submissionId,
  status,
  editable,
  countryName,
  cycleLabel,
  phaseLabel,
  closesAt,
  sectors,
  initialReadiness,
}: {
  submissionId: string;
  status: SubmissionStatus;
  editable: boolean;
  countryName: string;
  cycleLabel: string;
  phaseLabel: string;
  closesAt: string;
  sectors: WorkspaceSector[];
  initialReadiness: ReadinessSummary;
}) {
  const router = useRouter();
  const t = useTranslations('workspace');
  const tPortal = useTranslations('portal');
  const tStatus = useTranslations('status');
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [, startTransition] = useTransition();

  const [values, setValues] = useState<Record<string, WorkspaceValue>>(() => {
    const map: Record<string, WorkspaceValue> = {};
    for (const s of sectors) for (const i of s.indicators) map[i.id] = i.value ?? { ...EMPTY };
    return map;
  });

  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [issues, setIssues] = useState<Record<string, { field: string; message: string }[]>>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [readiness, setReadiness] = useState(initialReadiness);
  const [open, setOpen] = useState<Set<string>>(new Set([sectors[0]?.code ?? '']));
  const [reviewIssues, setReviewIssues] = useState<
    { indicatorCode: string; indicatorName: string; message: string }[] | null
  >(null);
  const [submitting, setSubmitting] = useState(false);

  const storageKey = `stisa:draft:${submissionId}`;

  // Mirrors of the two pieces of state that the debounced autosave and the
  // beforeunload handler need to read *later*, outside the render that
  // produced them. Both are written only from event handlers and effects.
  const dirtyRef = useRef(dirty);
  const valuesRef = useRef(values);

  const writeBuffer = useCallback(
    (nextValues: Record<string, WorkspaceValue>, keys: Set<string>) => {
      try {
        const buffer: Record<string, WorkspaceValue> = {};
        for (const k of keys) buffer[k] = nextValues[k]!;
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ values: buffer, keys: [...keys] }),
        );
      } catch {
        // Storage may be full or blocked; the database remains authoritative.
      }
    },
    [storageKey],
  );

  // ---- crash-recovery buffer ---------------------------------------------
  // Written on every keystroke, read once on mount, cleared on a successful save.
  // This is an external-store read that cannot run during SSR, so it has to
  // happen in an effect.
  useEffect(() => {
    if (!editable) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { values: Record<string, WorkspaceValue>; keys: string[] };
      if (!parsed.keys?.length) return;

      const merged = { ...valuesRef.current, ...parsed.values };
      const recovered = new Set(parsed.keys);
      valuesRef.current = merged;
      dirtyRef.current = recovered;
      setValues(merged);
      setDirty(recovered);
      toast.info(t('recovered'), { description: t('recoveredBody') });
    } catch {
      // A corrupt buffer must never block the workspace.
      window.localStorage.removeItem(storageKey);
    }
    // Runs once on mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback(
    (indicatorId: string, patch: Partial<WorkspaceValue>) => {
      if (!editable) return;

      const current = valuesRef.current[indicatorId] ?? EMPTY;
      const nextValues = { ...valuesRef.current, [indicatorId]: { ...current, ...patch } };
      const nextDirty = new Set(dirtyRef.current).add(indicatorId);

      valuesRef.current = nextValues;
      dirtyRef.current = nextDirty;

      setValues(nextValues);
      setDirty(nextDirty);
      setSaveState('idle');
      writeBuffer(nextValues, nextDirty);
    },
    [editable, writeBuffer],
  );

  // ---- saving -------------------------------------------------------------
  const persist = useCallback(
    async (ids: string[], { silent }: { silent?: boolean } = {}) => {
      if (ids.length === 0) return true;
      setSaveState('saving');

      const payload = ids.map((id) => {
        const v = valuesRef.current[id]!;
        return {
          indicatorId: id,
          dataAvailable: v.dataAvailable,
          notApplicable: v.notApplicable,
          baselineValue: v.baselineValue || null,
          targetValue: v.targetValue || null,
          actualValue: v.actualValue || null,
          booleanValue: v.booleanValue,
          textValue: v.textValue || null,
          categoricalValue: v.categoricalValue || null,
          baselineYear: v.baselineYear,
          currencyCode: v.currencyCode || null,
          notes: v.notes || null,
          sourceName: v.sourceName || null,
          sourceUrl: v.sourceUrl || null,
        };
      });

      const result = await saveValues({ submissionId, values: payload });

      if (!result.ok) {
        setSaveState('error');
        toast.error(t('couldNotSave'), { description: result.error });
        return false;
      }

      setIssues((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return { ...next, ...result.data.issues };
      });

      const remaining = new Set(dirtyRef.current);
      for (const id of ids) remaining.delete(id);
      dirtyRef.current = remaining;
      setDirty(remaining);

      // The recovery buffer exists only to survive a crash with unsaved edits;
      // once the database holds everything it must be cleared, or a later
      // session would "recover" stale values over newer server data.
      try {
        if (remaining.size === 0) window.localStorage.removeItem(storageKey);
        else writeBuffer(valuesRef.current, remaining);
      } catch {
        /* storage unavailable — the database is still authoritative */
      }

      setReadiness((prev) => ({
        ...prev,
        totals: {
          ...prev.totals,
          completenessPct: result.data.completenessPct,
          reported: result.data.reportedCount,
          expected: result.data.expectedCount,
        },
      }));

      setSaveState('saved');
      if (!silent) toast.success(t('savedToast', { count: ids.length }));
      return true;
    },
    [submissionId, storageKey, writeBuffer, t],
  );

  // Autosave: a quiet 2.5s debounce so typing is never interrupted, but the
  // database still becomes authoritative quickly.
  useEffect(() => {
    if (!editable || dirty.size === 0) return;
    const timer = setTimeout(() => {
      void persist([...dirtyRef.current], { silent: true });
    }, 2500);
    return () => clearTimeout(timer);
  }, [dirty, editable, persist]);

  // Warn before navigating away with unsaved edits.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current.size > 0) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ---- derived ------------------------------------------------------------
  const sectorProgress = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const s of sectors) {
      let done = 0;
      for (const i of s.indicators) {
        const v = values[i.id];
        if (!v) continue;
        const complete =
          v.notApplicable ||
          (v.dataAvailable && (issues[i.id]?.length ?? 0) === 0 && hasValue(v, i.dataType));
        if (complete) done++;
      }
      map.set(s.code, { done, total: s.indicators.length });
    }
    return map;
  }, [sectors, values, issues]);

  const totalIndicators = sectors.reduce((a, s) => a + s.indicators.length, 0);
  const answered = readiness.totals.reported + readiness.totals.notApplicable;

  // ---- actions ------------------------------------------------------------
  const onSaveDraft = async () => {
    // Deliberately no router.refresh() here. The client already holds exactly
    // what was saved, and refreshing would remount this component (see the key
    // in page.tsx), collapsing every open category mid-edit.
    await persist([...dirty]);
  };

  const onReview = async () => {
    await persist([...dirty], { silent: true });
    const result = await checkReadiness(submissionId);
    if (!result.ok) {
      toast.error(t('checkFailed'), { description: result.error });
      return;
    }
    setReadiness({
      totals: result.data.totals,
      checks: result.data.checks,
      issueCount: result.data.issues.length,
    });
    setReviewIssues(
      result.data.issues.map((i) => ({
        indicatorCode: i.indicatorCode,
        indicatorName: i.indicatorName,
        message: i.message,
      })),
    );
    if (result.data.ready) {
      toast.success(t('readyToast'), { description: t('readyToastBody') });
    }
  };

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const saved = await persist([...dirty], { silent: true });
      if (!saved) return;

      const result = await transitionSubmission({ submissionId, to: 'SUBMITTED' });
      if (!result.ok) {
        toast.error(t('submissionFailed'), { description: result.error });
        return;
      }
      if (result.data.blockingIssues?.length) {
        setReviewIssues(result.data.blockingIssues);
        toast.error(t('cannotFinalise'), {
          description: t('blockedTitle', { count: result.data.blockingIssues.length }),
        });
        return;
      }
      toast.success(t('submittedToast'), { description: t('submittedToastBody') });
      startTransition(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSector = (code: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  // ---- render -------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Sticky summary bar */}
      <div className="glass sticky top-[6.5rem] z-30 -mx-4 rounded-none border-y px-4 py-3 sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs">
              {countryName} · {phaseLabel}
            </p>
            <h1 className="font-heading truncate text-lg font-semibold">
              STISA 2034 — {cycleLabel}
            </h1>
          </div>

          <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">{tPortal('complete')}</dt>
              <dd className="font-semibold tnum">
                {readiness.totals.completenessPct.toFixed(0)}%
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{tPortal('reported')}</dt>
              <dd className="font-semibold tnum">
                {answered} / {readiness.totals.expected}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{tPortal('unsaved')}</dt>
              <dd className="font-semibold tnum">{dirty.size}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{tPortal('missing')}</dt>
              <dd className="font-semibold tnum">{readiness.totals.missing}</dd>
            </div>
          </dl>

          <div className="flex items-center gap-2">
            <SaveIndicator state={saveState} dirty={dirty.size} />
          </div>
        </div>

        <Meter className="mt-2.5" value={readiness.totals.completenessPct} />
      </div>

      {/* Action bar */}
      {editable ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={onSaveDraft} variant="secondary" disabled={dirty.size === 0 || saveState === 'saving'}>
            <Save className="size-4" />
            {tPortal('saveDraft')}
          </Button>
          <Button onClick={onReview} variant="outline">
            <CheckCircle2 className="size-4" />
            {tPortal('review')}
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {tPortal('submitFinal')}
          </Button>
        </div>
      ) : null}

      {/* Readiness result */}
      <AnimatePresence>
        {reviewIssues !== null ? (
          <motion.div
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {reviewIssues.length === 0 ? (
              <Alert className="border-success/40 bg-success/8">
                <CheckCircle2 className="size-4" />
                <AlertTitle>{t('readyTitle')}</AlertTitle>
                <AlertDescription>
                  {t('readyBody')}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-warning/40 bg-warning/8">
                <AlertTriangle className="size-4" />
                <AlertTitle>
                  {t('blockedTitle', { count: reviewIssues.length })}
                </AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-xs">
                    {reviewIssues.map((i, idx) => (
                      <li key={`${i.indicatorCode}-${idx}`}>
                        <span className="font-mono font-medium">{i.indicatorCode}</span> —{' '}
                        {i.message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Sectors */}
      <div className="space-y-3">
        {sectors.map((sector) => {
          const progress = sectorProgress.get(sector.code) ?? { done: 0, total: 0 };
          const isOpen = open.has(sector.code);

          return (
            <Card key={sector.code} className="overflow-hidden py-0">
              <button
                type="button"
                onClick={() => toggleSector(sector.code)}
                aria-expanded={isOpen}
                className={cn(
                  'hover:bg-muted/50 flex w-full items-center gap-3 border-l-4 px-5 py-4 text-left transition-colors',
                  progress.total === 0
                    ? 'border-l-border'
                    : progress.done === progress.total
                      ? 'border-l-success'
                      : progress.done > 0
                        ? 'border-l-accent'
                        : 'border-l-destructive/50',
                )}
              >
                <ChevronDown
                  className={cn('size-4 shrink-0 transition-transform', isOpen && 'rotate-180')}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{sector.name}</p>
                  {sector.subtitle ? (
                    <p className="text-muted-foreground truncate text-xs">{sector.subtitle}</p>
                  ) : null}
                </div>
                <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-sm tnum">
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      progress.total === 0
                        ? 'bg-muted-foreground/30'
                        : progress.done === progress.total
                          ? 'bg-success'
                          : progress.done > 0
                            ? 'bg-accent'
                            : 'bg-destructive/60',
                    )}
                    aria-hidden
                  />
                  {t('sectorComplete', { done: progress.done, total: progress.total })}
                </span>
                <div className="hidden w-24 shrink-0 sm:block">
                  <Meter
                    value={progress.total === 0 ? 0 : (progress.done / progress.total) * 100}
                  />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    initial={reduced ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <CardContent className="space-y-4 border-t px-5 py-5">
                      {sector.indicators.map((indicator) => (
                        <IndicatorRow
                          key={indicator.id}
                          indicator={indicator}
                          value={values[indicator.id] ?? EMPTY}
                          issues={issues[indicator.id] ?? []}
                          editable={editable}
                          onChange={(patch) => update(indicator.id, patch)}
                        />
                      ))}
                    </CardContent>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        {t('footnote', {
          total: totalIndicators,
          sectors: sectors.length,
          cycle: cycleLabel,
          date: new Date(closesAt).toLocaleDateString(locale, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          }),
        })}{' '}
        {t('currentStatusLine', { status: tStatus(status) })}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function hasValue(v: WorkspaceValue, dataType: string): boolean {
  if (NUMERIC.has(dataType)) return v.actualValue.trim() !== '';
  if (dataType === 'BOOLEAN') return v.booleanValue !== null;
  if (dataType === 'CATEGORICAL') return v.categoricalValue.trim() !== '';
  return v.textValue.trim() !== '';
}

function SaveIndicator({ state, dirty }: { state: string; dirty: number }) {
  const t = useTranslations('workspace');
  if (state === 'saving')
    return (
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Loader2 className="size-3.5 animate-spin" /> {t('saving')}
      </span>
    );
  if (state === 'error')
    return (
      <span className="text-destructive flex items-center gap-1.5 text-xs">
        <CloudOff className="size-3.5" /> {t('notSaved')}
      </span>
    );
  if (dirty > 0)
    return (
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <span className="bg-warning size-1.5 rounded-full" aria-hidden />
        {t('unsavedCount', { count: dirty })}
      </span>
    );
  if (state === 'saved')
    return (
      <span className="text-success flex items-center gap-1.5 text-xs">
        <Check className="size-3.5" /> {t('saved')}
      </span>
    );
  return <span className="text-muted-foreground text-xs">{t('allSaved')}</span>;
}

// ---------------------------------------------------------------------------

function IndicatorRow({
  indicator,
  value,
  issues,
  editable,
  onChange,
}: {
  indicator: WorkspaceIndicator;
  value: WorkspaceValue;
  issues: { field: string; message: string }[];
  editable: boolean;
  onChange: (patch: Partial<WorkspaceValue>) => void;
}) {
  const t = useTranslations('workspace');
  const tPortal = useTranslations('portal');
  const tFlags = useTranslations('flagsWorkspace');
  const numeric = NUMERIC.has(indicator.dataType);
  const issueFor = (field: string) => issues.find((i) => i.field === field)?.message;
  const flags = indicator.flags.filter((f): f is WorkspaceFlag =>
    (SHOWN_FLAGS as readonly string[]).includes(f),
  );

  const stateBadge = value.notApplicable
    ? { label: t('notApplicable'), tone: 'bg-muted text-muted-foreground' }
    : issues.length > 0
      ? {
          label: t('needsAttention'),
          tone: 'bg-warning/15 text-warning-foreground border-warning/40',
        }
      : value.dataAvailable && hasValue(value, indicator.dataType)
        ? { label: t('reported'), tone: 'bg-success/12 text-success border-success/30' }
        : { label: t('notReported'), tone: 'bg-muted text-muted-foreground' };

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        value.notApplicable
          ? 'bg-muted/30 opacity-80'
          : issues.length > 0
            ? 'border-warning/50 bg-warning/5'
            : value.dataAvailable && hasValue(value, indicator.dataType)
              ? 'border-success/35 bg-success/5'
              : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {indicator.code}
            </Badge>
            <Badge variant="outline" className={cn('text-[0.68rem]', stateBadge.tone)}>
              {stateBadge.label}
            </Badge>
            <span className="text-muted-foreground text-xs">{indicator.unit}</span>
          </div>

          <p className="text-sm leading-relaxed">{indicator.sourceText}</p>

          {indicator.definition ? (
            <p className="text-muted-foreground text-xs leading-relaxed">{indicator.definition}</p>
          ) : null}

          {flags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {flags.map((f) => (
                <Badge
                  key={f}
                  variant="outline"
                  className="border-warning/40 bg-warning/10 text-warning-foreground text-[0.66rem]"
                >
                  {tFlags(f)}
                </Badge>
              ))}
            </div>
          ) : null}

          {indicator.ambiguityNote ? (
            <p className="text-muted-foreground flex items-start gap-1.5 pt-1 text-xs leading-relaxed">
              <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span>{indicator.ambiguityNote}</span>
            </p>
          ) : null}
        </div>
      </div>

      {/* Availability switches */}
      <div className="mt-4 flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary size-4"
            checked={value.dataAvailable}
            disabled={!editable || value.notApplicable}
            onChange={(e) => onChange({ dataAvailable: e.target.checked })}
          />
          {tPortal('dataAvailable')}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary size-4"
            checked={value.notApplicable}
            disabled={!editable}
            onChange={(e) =>
              onChange({ notApplicable: e.target.checked, dataAvailable: false })
            }
          />
          {tPortal('notApplicableToState')}
        </label>
      </div>

      {/* Value fields */}
      {value.notApplicable ? (
        <Field
          className="mt-4"
          label={t('notApplicableReason')}
          error={issueFor('notes')}
          required
        >
          <Textarea
            rows={2}
            value={value.notes}
            disabled={!editable}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder={t('notApplicablePlaceholder')}
          />
        </Field>
      ) : value.dataAvailable ? (
        <div className="mt-4 space-y-4">
          {numeric ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={tPortal('baseline')} error={issueFor('baselineValue')}>
                <Input
                  inputMode="decimal"
                  value={value.baselineValue}
                  disabled={!editable}
                  onChange={(e) => onChange({ baselineValue: e.target.value })}
                  placeholder="—"
                  className="tnum"
                />
              </Field>
              <Field label={tPortal('target')} error={issueFor('targetValue')} required>
                <Input
                  inputMode="decimal"
                  value={value.targetValue}
                  disabled={!editable}
                  onChange={(e) => onChange({ targetValue: e.target.value })}
                  placeholder="—"
                  className="tnum"
                />
              </Field>
              <Field label={tPortal('actual')} error={issueFor('actualValue')} required>
                <Input
                  inputMode="decimal"
                  value={value.actualValue}
                  disabled={!editable}
                  onChange={(e) => onChange({ actualValue: e.target.value })}
                  placeholder="—"
                  className="tnum"
                />
              </Field>
            </div>
          ) : indicator.dataType === 'BOOLEAN' ? (
            <Field label={t('achieved')} error={issueFor('booleanValue')} required>
              <div className="flex gap-2">
                {[
                  { label: t('yes'), v: true },
                  { label: t('no'), v: false },
                ].map((opt) => (
                  <Button
                    key={opt.label}
                    type="button"
                    size="sm"
                    variant={value.booleanValue === opt.v ? 'default' : 'outline'}
                    disabled={!editable}
                    onClick={() => onChange({ booleanValue: opt.v })}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </Field>
          ) : (
            <Field
              label={indicator.dataType === 'URL' ? t('url') : t('value')}
              error={issueFor('textValue')}
              required
            >
              <Input
                value={value.textValue}
                disabled={!editable}
                onChange={(e) => onChange({ textValue: e.target.value })}
                placeholder={indicator.dataType === 'URL' ? 'https://…' : ''}
              />
            </Field>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('baselineYear')}>
              <Input
                inputMode="numeric"
                value={value.baselineYear ?? ''}
                disabled={!editable}
                onChange={(e) =>
                  onChange({
                    baselineYear: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                placeholder="2024"
                className="tnum"
              />
            </Field>
            {indicator.dataType === 'CURRENCY' ? (
              <Field
                label={t('currency')}
                error={issueFor('currencyCode')}
                hint={t('currencyHint')}
                required
              >
                <Input
                  value={value.currencyCode}
                  disabled={!editable}
                  onChange={(e) => onChange({ currencyCode: e.target.value.toUpperCase() })}
                  placeholder="USD"
                  maxLength={3}
                />
              </Field>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={tPortal('dataSource')}
              error={issueFor('sourceName')}
              required={indicator.sourceRequired}
            >
              <Input
                value={value.sourceName}
                disabled={!editable}
                onChange={(e) => onChange({ sourceName: e.target.value })}
                placeholder={t('sourcePlaceholder')}
              />
            </Field>
            <Field label={tPortal('sourceLink')} error={issueFor('sourceUrl')}>
              <Input
                value={value.sourceUrl}
                disabled={!editable}
                onChange={(e) => onChange({ sourceUrl: e.target.value })}
                placeholder="https://…"
              />
            </Field>
          </div>

          <Field label={tPortal('notes')} hint={t('notesHint')}>
            <Textarea
              rows={2}
              value={value.notes}
              disabled={!editable}
              onChange={(e) => onChange({ notes: e.target.value })}
            />
          </Field>
        </div>
      ) : (
        <Field
          className="mt-4"
          label={t('whyUnavailable')}
          error={issueFor('notes')}
          hint={t('whyUnavailableHint')}
        >
          <Textarea
            rows={2}
            value={value.notes}
            disabled={!editable}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder={t('whyUnavailablePlaceholder')}
          />
        </Field>
      )}

      {issues.length > 0 ? (
        <ul className="text-warning-foreground mt-3 space-y-0.5 text-xs">
          {issues.map((i, idx) => (
            <li key={idx}>• {i.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  error,
  hint,
  required,
  className,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs">
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}
