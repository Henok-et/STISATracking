'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Heatmap } from '@/lib/analytics/queries';

/**
 * Country x sector reporting coverage.
 *
 * Missing data is rendered as a distinct hatched cell, never as the lightest
 * shade of the ramp — otherwise "did not report" would be indistinguishable
 * from "reported almost nothing".
 */

const REGION_LABELS: Record<string, string> = {
  NORTH: 'Northern',
  WEST: 'Western',
  CENTRAL: 'Central',
  EAST: 'Eastern',
  SOUTH: 'Southern',
};

function shade(pct: number): string {
  if (pct >= 90) return 'bg-primary text-primary-foreground';
  if (pct >= 70) return 'bg-primary/75 text-primary-foreground';
  if (pct >= 50) return 'bg-primary/55 text-primary-foreground';
  if (pct >= 25) return 'bg-primary/32';
  return 'bg-primary/15';
}

export function CountryHeatmap({ heatmap }: { heatmap: Heatmap }) {
  const t = useTranslations('dashboard.heatmap');
  const tTable = useTranslations('table');
  const [region, setRegion] = useState<string>('ALL');

  const cellIndex = useMemo(() => {
    const map = new Map<string, { pct: number | null; reported: number; expected: number }>();
    for (const c of heatmap.cells) {
      map.set(`${c.countryIso2}::${c.sectorCode}`, {
        pct: c.completenessPct,
        reported: c.reported,
        expected: c.expected,
      });
    }
    return map;
  }, [heatmap.cells]);

  const countries = useMemo(
    () =>
      region === 'ALL'
        ? heatmap.countries
        : heatmap.countries.filter((c) => c.regionCode === region),
    [heatmap.countries, region],
  );

  const regions = ['ALL', ...Object.keys(REGION_LABELS)];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {regions.map((r) => (
          <Button
            key={r}
            size="sm"
            variant={region === r ? 'default' : 'outline'}
            onClick={() => setRegion(r)}
          >
            {r === 'ALL' ? t('allRegions') : REGION_LABELS[r]}
          </Button>
        ))}
      </div>

      <div className="scroll-x">
        <table className="w-max border-separate border-spacing-0.5 text-xs">
          <caption className="sr-only">
            Reporting completeness by Member State and sector, as a percentage of that sector&apos;s
            indicators.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="text-muted-foreground sticky left-0 z-10 bg-card px-2 py-1 text-left font-medium">
                {tTable('memberState')}
              </th>
              {heatmap.sectors.map((s) => (
                <th
                  key={s.code}
                  scope="col"
                  className="text-muted-foreground px-1 py-1 text-center font-medium"
                  title={`${s.name} (${s.indicatorCount} indicators)`}
                >
                  <span className="font-mono">{s.code}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {countries.map((c) => (
              <tr key={c.iso2}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-card px-2 py-1 text-left font-normal whitespace-nowrap"
                >
                  <Link href={`/countries/${c.iso2}`} className="hover:text-primary hover:underline">
                    {c.name}
                  </Link>
                </th>
                {heatmap.sectors.map((s) => {
                  const cell = cellIndex.get(`${c.iso2}::${s.code}`);
                  const value = cell?.pct ?? null;
                  const title =
                    value === null
                      ? `${c.name} — ${s.name}: not reported`
                      : `${c.name} — ${s.name}: ${cell!.reported} of ${cell!.expected} indicators (${value.toFixed(0)}%)`;

                  return (
                    <td key={s.code} className="p-0">
                      <div
                        title={title}
                        aria-label={title}
                        className={cn(
                          'grid size-7 place-items-center rounded-sm text-[0.6rem] font-medium tnum',
                          value === null
                            ? 'bg-muted/60 text-muted-foreground border-border border border-dashed'
                            : shade(value),
                        )}
                      >
                        {value === null ? '·' : value.toFixed(0)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="border-border bg-muted/60 inline-block size-3 rounded-sm border border-dashed" />
          {t('notReported')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-primary/15 inline-block size-3 rounded-sm" />
          {t('lowCoverage')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-primary inline-block size-3 rounded-sm" />
          {t('complete')}
        </span>
        <span>{t('columnNote')}</span>
      </div>
    </div>
  );
}
