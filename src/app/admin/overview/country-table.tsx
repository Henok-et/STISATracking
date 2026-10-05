'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge, Meter } from '@/components/data-display';
import { STATUS_ORDER } from '@/lib/submissions/workflow';
import type { AdminCountryRow } from '@/lib/admin/queries';

const REGION_CODES = ['NORTH', 'WEST', 'CENTRAL', 'EAST', 'SOUTH'] as const;

/** Literal band labels stay as-is; only 'ALL' and 'LOW' need translating. */
const COMPLETENESS_BANDS = [
  { key: 'ALL', label: null, test: () => true },
  { key: 'NONE', label: '0%', test: (r: AdminCountryRow) => r.completenessPct === 0 },
  { key: 'LOW', label: null, test: (r: AdminCountryRow) => r.completenessPct > 0 && r.completenessPct < 50 },
  { key: 'MID', label: '50–99%', test: (r: AdminCountryRow) => r.completenessPct >= 50 && r.completenessPct < 100 },
  { key: 'FULL', label: '100%', test: (r: AdminCountryRow) => r.completenessPct >= 100 },
] as const;

export function AdminCountryTable({ rows }: { rows: AdminCountryRow[] }) {
  const t = useTranslations('admin');
  const tRegion = useTranslations('regions');
  const tStatus = useTranslations('status');
  const tTable = useTranslations('table');
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [band, setBand] = useState('ALL');

  const filtered = useMemo(() => {
    const bandTest = COMPLETENESS_BANDS.find((b) => b.key === band)?.test ?? (() => true);
    return rows.filter((r) => {
      if (region !== 'ALL' && r.regionCode !== region) return false;
      if (status !== 'ALL' && r.status !== status) return false;
      if (!bandTest(r)) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !r.regionName.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [rows, region, status, band, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchStates')}
          className="max-w-xs"
          aria-label={t('searchStatesLabel')}
        />

        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          aria-label={t('filterByRegion')}
          className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
        >
          <option value="ALL">{t('allRegions')}</option>
          {REGION_CODES.map((code) => (
            <option key={code} value={code}>
              {tRegion(code)}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={t('filterByStatus')}
          className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
        >
          <option value="ALL">{t('anyStatus')}</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {tStatus(s)}
            </option>
          ))}
        </select>

        <select
          value={band}
          onChange={(e) => setBand(e.target.value)}
          aria-label={t('filterByCompleteness')}
          className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
        >
          {COMPLETENESS_BANDS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label ?? (b.key === 'ALL' ? t('anyCompleteness') : t('under50'))}
            </option>
          ))}
        </select>

        {(region !== 'ALL' || status !== 'ALL' || band !== 'ALL' || query) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRegion('ALL');
              setStatus('ALL');
              setBand('ALL');
              setQuery('');
            }}
          >
            {t('clearFilters')}
          </Button>
        ) : null}

        <span className="text-muted-foreground ms-auto self-center text-xs tnum">
          {t('showingOf', { shown: filtered.length, total: rows.length })}
        </span>
      </div>

      <div className="scroll-x">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b">
              <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tTable('memberState')}</th>
              <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tTable('region')}</th>
              <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tTable('status')}</th>
              <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tTable('completeness')}</th>
              <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{t('focalPoints')}</th>
              <th scope="col" className="text-muted-foreground py-2 text-start text-xs font-medium">{t('review')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.countryId} className="hover:bg-muted/40 border-b last:border-0">
                <td className="py-2.5 pr-3">
                  <span className="font-medium">{r.name}</span>
                  {!r.active ? (
                    <Badge variant="outline" className="ms-2 text-[0.65rem]">
                      {t('inactive')}
                    </Badge>
                  ) : null}
                </td>
                <td className="text-muted-foreground py-2.5 pr-3 text-xs">{r.regionName}</td>
                <td className="py-2.5 pr-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="w-44 py-2.5 pr-3">
                  <Meter
                    value={r.completenessPct}
                    label={`${r.completenessPct.toFixed(0)}% · ${r.reportedCount}/${r.expectedCount}`}
                  />
                </td>
                <td className="py-2.5 pr-3">
                  {r.focalPoints === 0 ? (
                    <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning-foreground text-[0.65rem]">
                      {t('noneAssigned')}
                    </Badge>
                  ) : (
                    <span className="text-xs tnum">{r.focalPoints}</span>
                  )}
                </td>
                <td className="py-2.5">
                  {r.submissionId ? (
                    <Link
                      href={`/admin/submissions/${r.submissionId}`}
                      className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                    >
                      {t('open')} <ExternalLink className="size-3" />
                    </Link>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted-foreground py-10 text-center text-sm">
                  {t('noStatesMatch')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
