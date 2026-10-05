import type { Metadata } from 'next';

import { getTranslations } from 'next-intl/server';
import { requireAdminOrRedirect } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { EXTRACTION_RECONCILIATION } from '@/data/stisa-taxonomy';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SectionHeading } from '@/components/data-display';
import { Reveal } from '@/components/reveal';
import { IndicatorManager } from './indicator-manager';

export const metadata: Metadata = {
  title: 'Indicators',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminIndicatorsPage() {
  const t = await getTranslations('adminPages');

  await requireAdminOrRedirect('/admin/indicators');

  const [sectors, valueCounts] = await Promise.all([
    prisma.sector.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { indicators: { orderBy: { sortOrder: 'asc' } } },
    }),
    prisma.submissionValue.groupBy({ by: ['indicatorId'], _count: { _all: true } }),
  ]);

  const dataCount = new Map(valueCounts.map((v) => [v.indicatorId, v._count._all]));
  const allIndicators = sectors.flatMap((s) => s.indicators);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Reveal>
        <SectionHeading
          className="mb-6"
          title={t('indicatorsTitle')}
          description={t('indicatorsDescription')}
        />
      </Reveal>

      <Reveal>
        <Alert className="border-warning/40 bg-warning/8 mb-6">
          <AlertTitle>{t('reconciliationTitle')}</AlertTitle>
          <AlertDescription className="leading-relaxed">
            {t('reconciliationBody', {
              rows: EXTRACTION_RECONCILIATION.rowsPrintedInSource,
              inScope: EXTRACTION_RECONCILIATION.rowsInScope,
              stated: EXTRACTION_RECONCILIATION.countStatedInProjectBrief,
            })}{' '}
            {t('compoundNote')}{' '}
            {t('candidateRows')}
            <span className="font-mono">
              {EXTRACTION_RECONCILIATION.compoundRowsThatCouldResolveTheDiscrepancy.join(', ')}
            </span>
            .
          </AlertDescription>
        </Alert>
      </Reveal>

      <Reveal>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('versioning')}</CardTitle>
            <CardDescription>{t('versioningDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed">
            <p>{t('versioningBody')}</p>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal>
        <IndicatorManager
          sectors={sectors.map((s) => ({
            code: s.code,
            name: s.name,
            resultLevel: s.resultLevel,
            indicators: s.indicators.map((i) => ({
              id: i.id,
              code: i.code,
              officialName: i.officialName,
              sourceText: i.sourceText,
              definition: i.definition,
              unit: i.unit,
              dataType: i.dataType,
              calculationMethod: i.calculationMethod,
              direction: i.direction,
              unitProvenance: i.unitProvenance,
              dataTypeProvenance: i.dataTypeProvenance,
              calculationProvenance: i.calculationProvenance,
              flags: i.flags,
              ambiguityNote: i.ambiguityNote,
              relatedCodes: i.relatedCodes,
              required: i.required,
              sourceRequired: i.sourceRequired,
              active: i.active,
              currentVersion: i.currentVersion,
              sourcePage: i.sourcePage,
              valueCount: dataCount.get(i.id) ?? 0,
            })),
          }))}
          totals={{
            indicators: allIndicators.length,
            active: allIndicators.filter((i) => i.active).length,
            withData: valueCounts.length,
          }}
        />
      </Reveal>
    </div>
  );
}
