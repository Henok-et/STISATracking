import { useTranslations } from 'next-intl';

import { Card, CardContent } from '@/components/ui/card';

/**
 * "How these two figures were arrived at", with the page's own live numbers
 * substituted into the arithmetic.
 *
 * The two headline figures on a sector or country page use DIFFERENT
 * denominators by design, and a reader has no way to guess that from the
 * numbers alone. Completeness asks how much data arrived; target progress asks
 * how what arrived scored. Seeing "67 of 96" next to "67 of 67" is confusing
 * precisely because the reader assumes one denominator.
 *
 * Rather than a static help page, this restates the actual sums for the figures
 * on screen, so the explanation can never drift from the data.
 */

export interface FigureBreakdown {
  indicatorsInSector: number;
  countriesReporting: number;
  expectedValues: number;
  reportedValues: number;
  notReported: number;
  notApplicable: number;
  unscored: number;
  scored: number;
}

export function FigureExplainer({
  breakdown,
  completenessPct,
  progressPct,
  /** "category" on a sector page, "Member State" on a country page. */
  scopeNoun = 'category',
}: {
  breakdown: FigureBreakdown;
  completenessPct: number | null;
  progressPct: number | null;
  scopeNoun?: string;
}) {
  const t = useTranslations('explainer');
  const b = breakdown;

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-5">
        <h3 className="font-heading text-sm font-semibold">{t('title')}</h3>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          {t('intro')}
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* ---- Completeness ------------------------------------------- */}
          <section className="space-y-2">
            <p className="text-sm font-medium">
              {t('completenessLabel')}
              {completenessPct !== null ? (
                <span className="text-primary ml-2 tnum">{completenessPct.toFixed(1)}%</span>
              ) : null}
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              <strong className="text-foreground">{t('completenessWhat')}</strong>{' '}
              {t('completenessBody', { scope: scopeNoun })}
            </p>

            <dl className="bg-background rounded-md border p-3 text-xs">
              <Row
                label={t('indicatorsInCategory')}
                value={b.indicatorsInSector}
              />
              <Row
                label={t('statesReported')}
                value={b.countriesReporting}
                operator="×"
              />
              <Row label={t('valuesExpected')} value={b.expectedValues} total />
              <div className="my-2 border-t" />
              <Row label={t('valuesReceived')} value={b.reportedValues} />
              <Row label={t('notReportedRow')} value={b.notReported} muted />
              <Row label={t('notApplicableRow')} value={b.notApplicable} muted />
            </dl>

            <p className="text-muted-foreground text-xs leading-relaxed">
              <span className="tnum">
                {b.reportedValues} ÷ {b.expectedValues} × 100 ={' '}
                {completenessPct === null ? '—' : `${completenessPct.toFixed(1)}%`}
              </span>
              . {t('missingNote', { missing: b.notReported + b.notApplicable })}
            </p>
          </section>

          {/* ---- Target progress ---------------------------------------- */}
          <section className="space-y-2">
            <p className="text-sm font-medium">
              {t('progressLabel')}
              {progressPct !== null ? (
                <span className="text-primary ml-2 tnum">{progressPct.toFixed(1)}%</span>
              ) : null}
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              <strong className="text-foreground">{t('progressWhat')}</strong>{' '}
              {t('progressBody')}
            </p>

            <dl className="bg-background rounded-md border p-3 text-xs">
              <Row label={t('valuesReceived')} value={b.reportedValues} />
              <Row label={t('couldNotScore')} value={b.unscored} muted operator="−" />
              <Row label={t('valuesAveraged')} value={b.scored} total />
            </dl>

            <p className="text-muted-foreground text-xs leading-relaxed">
              {b.unscored > 0
                ? t('unscoredNote', { count: b.unscored })
                : t('allScoredNote', { count: b.reportedValues })}
            </p>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  operator,
  total,
  muted,
}: {
  label: string;
  value: number;
  operator?: string;
  total?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={
        total
          ? 'mt-1 flex items-baseline justify-between gap-3 border-t pt-1 font-medium'
          : 'flex items-baseline justify-between gap-3'
      }
    >
      <dt className={muted ? 'text-muted-foreground' : undefined}>
        {operator ? <span className="text-muted-foreground mr-1">{operator}</span> : null}
        {label}
      </dt>
      <dd className={`tnum ${muted ? 'text-muted-foreground' : ''}`}>{value}</dd>
    </div>
  );
}
