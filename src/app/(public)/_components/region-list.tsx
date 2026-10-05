import { useTranslations } from 'next-intl';

import { MetricRow } from '@/components/data-display';
import type { RegionPerformance } from '@/lib/analytics/queries';

/**
 * The five AU regions as the same two-meter rows used for categories and
 * Member States. The count of reporting states travels with each row, because
 * a regional average built on 2 of 15 states must not look as solid as one
 * built on 12.
 */
export function RegionList({ regions }: { regions: RegionPerformance[] }) {
  const tCommon = useTranslations('common');

  return (
    <ul className="divide-y">
      {regions.map((r) => (
        <MetricRow
          key={r.regionCode}
          name={r.regionName}
          meta={tCommon('reportingOf', {
            reporting: r.countriesReporting,
            total: r.countriesTotal,
          })}
          completeness={r.completeness}
          progress={r.targetProgress}
        />
      ))}
    </ul>
  );
}
