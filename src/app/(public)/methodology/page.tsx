import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/db';
import { EXTRACTION_RECONCILIATION } from '@/data/stisa-taxonomy';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SectionHeading } from '@/components/data-display';
import { Reveal } from '@/components/reveal';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Methodology',
  description:
    'How STISA 2034 indicators are defined, validated, aggregated and scored — including the treatment of missing data and unscored indicators.',
};

export default async function MethodologyPage() {
  const [t, tCommon] = await Promise.all([
    getTranslations('methodology'),
    getTranslations('common'),
  ]);

  const [indicatorCount, sectorCount, countryCount, flaggedCounts] = await Promise.all([
    prisma.indicator.count({ where: { active: true } }),
    prisma.sector.count({ where: { active: true } }),
    prisma.country.count({ where: { active: true } }),
    prisma.indicator.findMany({ where: { active: true }, select: { flags: true } }),
  ]);

  const tally = new Map<string, number>();
  for (const i of flaggedCounts) for (const f of i.flags) tally.set(f, (tally.get(f) ?? 0) + 1);

  const notable = [
    ['COMPOUND_STATEMENT', t('ambCompound')],
    ['DUPLICATE_OF_ANOTHER_ROW', t('ambDuplicate')],
    ['OVERLAPS_ANOTHER_ROW', t('ambOverlaps')],
    ['REQUIRES_DISAGGREGATION', t('ambDisaggregation')],
    ['CONTINENTAL_LEVEL_WORDING', t('ambContinental')],
    ['AMBIGUOUS_MEASUREMENT_BASIS', t('ambBasis')],
    ['UNIT_NOT_SPECIFIED', t('ambUnit')],
  ] as const;

  // Symbolic formulae: the operators stay as printed, only the operand names
  // are translated, so the arithmetic reads identically in every language.
  const formulae = [
    [t('mLevelHigher'), `(${t('fActual')} − ${t('fBaseline')}) ÷ (${t('fTarget')} − ${t('fBaseline')}) × 100`],
    [t('mLevelLower'), `(${t('fBaseline')} − ${t('fActual')}) ÷ (${t('fBaseline')} − ${t('fTarget')}) × 100`],
    [t('mLevelNoBaseline'), `${t('fActual')} ÷ ${t('fTarget')} × 100`],
    [t('mChange'), `${t('fActualChange')} ÷ ${t('fTargetChange')} × 100`],
    [t('mCloseness'), `(1 − |${t('fActual')} − ${t('fTarget')}| ÷ |${t('fTarget')}|) × 100`],
    [t('mBinary'), t('fAchieved')],
    [t('mUndefined'), t('fNotScored')],
  ] as const;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <Reveal>
        <SectionHeading className="mb-10" title={t('title')} description={t('intro')} />
      </Reveal>

      <div className="space-y-8">
        <Reveal>
          <Card id="sources">
            <CardHeader>
              <CardTitle>{t('sourcesTitle')}</CardTitle>
              <CardDescription>{t('sourcesDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <p>{t('sourcesBody')}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="font-heading text-2xl font-semibold tnum">{indicatorCount}</p>
                  <p className="text-muted-foreground text-xs">{t('statRows')}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="font-heading text-2xl font-semibold tnum">{sectorCount}</p>
                  <p className="text-muted-foreground text-xs">{t('statCategories')}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="font-heading text-2xl font-semibold tnum">{countryCount}</p>
                  <p className="text-muted-foreground text-xs">{t('statStates')}</p>
                </div>
              </div>

              <div className="border-warning/40 bg-warning/8 rounded-lg border p-4">
                <p className="font-medium">{t('countTitle')}</p>
                <p className="text-muted-foreground mt-1 leading-relaxed">
                  {t('countBodyBefore')}
                  <strong className="text-foreground">
                    {t('countRows', { rows: EXTRACTION_RECONCILIATION.rowsPrintedInSource })}
                  </strong>
                  {t('countBodyScope', { inScope: EXTRACTION_RECONCILIATION.rowsInScope })}
                  {t('countBodyAfter', {
                    stated: EXTRACTION_RECONCILIATION.countStatedInProjectBrief,
                    candidates:
                      EXTRACTION_RECONCILIATION.compoundRowsThatCouldResolveTheDiscrepancy.join(', '),
                  })}{' '}
                  {t('compoundNote')}
                </p>
              </div>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal>
          <Card>
            <CardHeader>
              <CardTitle>{t('notSuppliedTitle')}</CardTitle>
              <CardDescription>{t('notSuppliedDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <p>{t('notSuppliedBody')}</p>
              <ul className="ms-4 list-disc space-y-2">
                <li>
                  <strong>{t('codesLead')}</strong>
                  {t('codesBody')}
                </li>
                <li>
                  <strong>{t('unitsLead')}</strong>
                  {t('unitsBody')}
                </li>
                <li>
                  <strong>{t('baselinesLead')}</strong>
                  {t('baselinesBody')}
                </li>
                <li>
                  <strong>{t('definitionsLead')}</strong>
                  {t('definitionsBody')}
                </li>
              </ul>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal>
          <Card id="missing-data">
            <CardHeader>
              <CardTitle>{t('missingTitle')}</CardTitle>
              <CardDescription>{t('missingDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <p>{t('missingBody')}</p>
              <ul className="ms-4 list-disc space-y-1.5">
                <li>
                  <strong>{tCommon('reported')}</strong> — {t('stateReported')}
                </li>
                <li>
                  <strong>{tCommon('notReported')}</strong> — {t('stateNotReported')}
                </li>
                <li>
                  <strong>{tCommon('notApplicable')}</strong> — {t('stateNotApplicable')}
                </li>
                <li>
                  <strong>{t('invalidLabel')}</strong> — {t('stateInvalid')}
                </li>
                <li>
                  <strong>{t('pendingLabel')}</strong> — {t('statePending')}
                </li>
              </ul>
              <p>{t('averagesAre')}</p>
              {/*
                Left-to-right even in Arabic: this is a formula, and mirroring
                it would move the ÷ to the wrong side of its operands.
              */}
              <pre
                dir="ltr"
                className="bg-muted overflow-x-auto rounded-md p-4 text-start font-mono text-xs"
              >
                {t('formula')}
              </pre>
              <p>
                {t('exclusionBefore')}
                <em>{t('exclusionExample')}</em>
                {t('exclusionAfter')}
              </p>
              <p>{t('completenessException')}</p>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal>
          <Card>
            <CardHeader>
              <CardTitle>{t('progressTitle')}</CardTitle>
              <CardDescription>{t('progressDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <p>{t('progressBody')}</p>
              <div className="scroll-x">
                <table className="w-full min-w-[34rem] text-xs">
                  <thead>
                    <tr className="border-b">
                      <th scope="col" className="py-2 pe-3 text-start font-medium">
                        {t('colMethodology')}
                      </th>
                      <th scope="col" className="py-2 text-start font-medium">
                        {t('colFormula')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {formulae.map(([method, formula]) => (
                      <tr key={method} className="border-b last:border-0">
                        <td className="py-2 pe-3">{method}</td>
                        <td className="py-2" dir="ltr">
                          {formula}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>{t('progressFloor')}</p>
              <p className="border-primary/40 border-s-2 ps-4">
                {t('progressCalloutBefore')}
                <strong>{tCommon('notScored').toLowerCase()}</strong>
                {t('progressCalloutAfter')}
              </p>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal>
          <Card>
            <CardHeader>
              <CardTitle>{t('ambiguitiesTitle')}</CardTitle>
              <CardDescription>{t('ambiguitiesDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {notable.map(([flag, label]) => (
                  <li
                    key={flag}
                    className="flex items-center justify-between gap-3 border-b pb-2 last:border-0"
                  >
                    <span className="leading-snug">{label}</span>
                    <Badge variant="secondary" className="tnum shrink-0">
                      {tally.get(flag) ?? 0}
                    </Badge>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
                {t('ambiguitiesNote')}
              </p>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal>
          <Card>
            <CardHeader>
              <CardTitle>{t('publicTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <p>
                {t('publicBodyBefore')}
                <strong>{t('publicBodyStrong')}</strong>
                {t('publicBodyAfter')}
              </p>
              <p>{t('publicHistory')}</p>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
