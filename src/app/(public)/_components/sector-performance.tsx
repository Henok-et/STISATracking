import { useTranslations } from 'next-intl';

import { MetricRow } from '@/components/data-display';
import type { SectorPerformance } from '@/lib/analytics/queries';

/**
 * The 16 in-scope MEAL Plan categories, grouped by result level.
 *
 * The grouping stays because the categories are not a flat list — they sit at
 * three levels of the results framework and collapsing that loses the
 * framework's meaning. The chart itself is now the same two-meter row used for
 * regions and Member States, replacing a dumbbell that needed a four-item
 * legend and an arrow readout ("67% → 45%") that read as a change over time.
 */

const LEVEL_ORDER = ['OUTCOME', 'SECTORIAL_PRIORITY', 'STRATEGIC_PRIORITY'] as const;

export function SectorPerformancePanel({ sectors }: { sectors: SectorPerformance[] }) {
  const tLevel = useTranslations('resultLevel');
  const tCommon = useTranslations('common');

  return (
    <div className="space-y-8">
      {LEVEL_ORDER.map((level) => {
        const group = sectors.filter((s) => s.resultLevel === level);
        if (group.length === 0) return null;

        // Every sector at a level carries the same verbatim result statement.
        const statement = group.find((s) => s.resultStatement)?.resultStatement ?? null;

        return (
          <section key={level} aria-labelledby={`level-${level}`}>
            <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-2">
              {/*
                Rendered as the MEAL Plan writes it — the level name, then its
                verbatim result statement where the source states one. The
                source states a result for the Outcome level and none for the
                two priority groupings. Where the source says nothing, so does
                this.
              */}
              <h3 id={`level-${level}`} className="min-w-0 flex-1 text-sm leading-relaxed">
                <span className="font-semibold">{tLevel(level)}</span>
                {statement ? (
                  <>
                    <span className="font-semibold">: </span>
                    <span className="text-muted-foreground">{statement}</span>
                  </>
                ) : null}
              </h3>
              <span className="text-muted-foreground shrink-0 text-xs tnum">
                {tCommon('categories', { count: group.length })}
              </span>
            </div>

            <ul className="divide-y">
              {group.map((s) => (
                <MetricRow
                  key={s.sectorCode}
                  name={s.sectorName}
                  href={`/sectors/${s.sectorCode}`}
                  subtitle={s.subtitle}
                  meta={tCommon('indicators', { count: s.indicatorCount })}
                  completeness={s.completeness}
                  progress={s.targetProgress}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
