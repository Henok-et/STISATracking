'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge, Meter, NoData, pct } from '@/components/data-display';
import type { CountryRow } from '@/lib/analytics/queries';

type SortKey = 'name' | 'completeness' | 'progress';

/** Declared at module scope so it is not recreated on every render. */
function SortButton({
  label,
  sortKey,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  onSort: (key: SortKey) => void;
}) {
  const t = useTranslations('table');
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-7 px-2 text-xs font-medium"
      onClick={() => onSort(sortKey)}
      aria-label={t('sortBy', { label })}
    >
      {label}
      <ArrowUpDown className="size-3" />
    </Button>
  );
}

/**
 * Member State table.
 *
 * Countries that have not reported sort last regardless of direction — placing
 * a null at the top of a "highest progress" sort would misrepresent it as a
 * result rather than an absence.
 */
export function LeaderboardTable({
  rows,
  limit,
  showSearch = false,
}: {
  rows: CountryRow[];
  limit?: number;
  showSearch?: boolean;
}) {
  const t = useTranslations('table');
  const tCountries = useTranslations('countries');
  const tCommon = useTranslations('common');
  const [sort, setSort] = useState<SortKey>('completeness');
  const [desc, setDesc] = useState(true);
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => {
    const filtered = query
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(query.toLowerCase()) ||
            r.regionName.toLowerCase().includes(query.toLowerCase()),
        )
      : rows;

    const withValue = (r: CountryRow) =>
      sort === 'completeness' ? r.completeness.value : r.targetProgress.value;

    const out = [...filtered].sort((a, b) => {
      if (sort === 'name') {
        return desc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
      }
      const av = withValue(a);
      const bv = withValue(b);
      // Non-reporting countries always sink to the bottom.
      if (av === null && bv === null) return a.name.localeCompare(b.name);
      if (av === null) return 1;
      if (bv === null) return -1;
      return desc ? bv - av : av - bv;
    });

    return limit ? out.slice(0, limit) : out;
  }, [rows, sort, desc, query, limit]);

  const toggle = (key: SortKey) => {
    if (sort === key) setDesc((d) => !d);
    else {
      setSort(key);
      setDesc(key !== 'name');
    }
  };

  return (
    <div className="space-y-3">
      {showSearch ? (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tCountries('searchPlaceholder')}
          className="max-w-sm"
          aria-label={tCountries('searchPlaceholder')}
        />
      ) : null}

      <div className="scroll-x">
        <table className="w-full min-w-[42rem] text-sm">
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2 text-left">
                <SortButton label={t('memberState')} sortKey="name" onSort={toggle} />
              </th>
              <th scope="col" className="text-muted-foreground py-2 text-left text-xs font-medium">
                {t('region')}
              </th>
              <th scope="col" className="py-2 text-left">
                <SortButton label={t('completeness')} sortKey="completeness" onSort={toggle} />
              </th>
              <th scope="col" className="py-2 text-left">
                <SortButton label={t('targetProgress')} sortKey="progress" onSort={toggle} />
              </th>
              <th scope="col" className="text-muted-foreground py-2 text-left text-xs font-medium">
                {t('status')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.countryId} className="hover:bg-muted/40 border-b last:border-0">
                <td className="py-2.5 pr-3">
                  <Link href={`/countries/${r.iso2}`} className="hover:text-primary font-medium hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="text-muted-foreground py-2.5 pr-3 text-xs">{r.regionName}</td>
                <td className="w-44 py-2.5 pr-3">
                  {r.completeness.value === null ? (
                    <NoData />
                  ) : (
                    <Meter
                      tone="completeness"
                      value={r.completeness.value}
                      label={`${pct(r.completeness.value, 0)}% · ${r.completeness.basisShort}`}
                    />
                  )}
                </td>
                <td className="w-44 py-2.5 pr-3">
                  {r.targetProgress.value === null ? (
                    <NoData label={tCommon('notScored')} />
                  ) : (
                    <Meter
                      tone="progress"
                      value={r.targetProgress.value}
                      label={`${pct(r.targetProgress.value, 0)}% · ${r.targetProgress.basisShort}`}
                    />
                  )}
                </td>
                <td className="py-2.5">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground py-8 text-center text-sm">
                  {tCountries('noMatches')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
