import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';

import { getSectorPerformance } from '@/lib/analytics/queries';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SectionHeading, Meter, DataBasis, pct } from '@/components/data-display';
import { Reveal } from '@/components/reveal';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Sectors and priorities',
  description:
    'The 18 categories of the STISA 2034 results framework: impact, outcomes, sectorial priorities and strategic priorities.',
};

const LEVEL_ORDER = ['OUTCOME', 'SECTORIAL_PRIORITY', 'STRATEGIC_PRIORITY'];

export default async function SectorsPage() {
  const t = await getTranslations('sectors');
  const tCommon = await getTranslations('common');
  const tChart = await getTranslations('chart');
  const tLevel = await getTranslations('resultLevelShort');

  const [performance, sectors] = await Promise.all([
    getSectorPerformance(),
    prisma.sector.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { indicators: { where: { active: true } } } } },
    }),
  ]);

  const perfByCode = new Map(performance.map((p) => [p.sectorCode, p]));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <Reveal>
        <SectionHeading
          className="mb-8"
          title={t('title')}
          description={t('description')}
        />
      </Reveal>

      {LEVEL_ORDER.map((level, levelIndex) => {
        const group = sectors.filter((s) => s.resultLevel === level);
        if (group.length === 0) return null;

        return (
          <section key={level} className="mb-10">
            <Reveal delay={levelIndex * 0.05}>
              <div className="mb-4 flex items-baseline gap-3">
                <h2 className="text-lg font-semibold sm:text-xl">{tLevel(level)}</h2>
                <Badge variant="secondary">{tCommon('categories', { count: group.length })}</Badge>
              </div>
            </Reveal>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {group.map((s, i) => {
                const p = perfByCode.get(s.code);
                return (
                  <Reveal key={s.code} delay={Math.min(i * 0.04, 0.3)}>
                    <Card className="h-full transition-colors hover:border-primary/40">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <Badge variant="outline" className="font-mono text-xs">{s.code}</Badge>
                          <span className="text-muted-foreground text-xs">
                            {tCommon('indicators', { count: s._count.indicators })}
                          </span>
                        </div>
                        <CardTitle className="mt-2 text-base leading-snug">
                          <Link href={`/sectors/${s.code}`} className="hover:text-primary hover:underline">
                            {s.name}
                          </Link>
                        </CardTitle>
                        {s.subtitle ? (
                          <CardDescription className="leading-relaxed">{s.subtitle}</CardDescription>
                        ) : null}
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Meter
                          tone="progress"
                          emptyLabel={tCommon('notScored')}
                          value={p?.targetProgress.value ?? null}
                          label={
                            p?.targetProgress.value == null
                              ? undefined
                              : tChart('targetProgressPct', { pct: pct(p.targetProgress.value) })
                          }
                        />
                        <DataBasis basis={p?.targetProgress.basis ?? tCommon('noData')} />
                        <span className="text-primary inline-flex items-center gap-1 text-xs font-medium">
                          {t('viewSector')} <ArrowRight className="size-3" />
                        </span>
                      </CardContent>
                    </Card>
                  </Reveal>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
