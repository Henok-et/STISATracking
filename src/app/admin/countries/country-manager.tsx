'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { updateCountry } from '@/lib/actions/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface CountryRow {
  id: string;
  name: string;
  shortName: string;
  iso2: string;
  iso3: string;
  regionId: string;
  regionName: string;
  active: boolean;
  userCount: number;
  submissionCount: number;
}

export function CountryManager({
  countries,
  regions,
}: {
  countries: CountryRow[];
  regions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const t = useTranslations('adminPages');
  const tAdmin = useTranslations('admin');
  const tTable = useTranslations('table');
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState('');

  const refresh = () => startTransition(() => router.refresh());

  async function apply(countryId: string, patch: Record<string, unknown>, message: string) {
    const result = await updateCountry({ countryId, ...patch });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(message);
    refresh();
  }

  const filtered = query
    ? countries.filter(
        (c) =>
          c.shortName.toLowerCase().includes(query.toLowerCase()) ||
          c.iso2.toLowerCase().includes(query.toLowerCase()) ||
          c.regionName.toLowerCase().includes(query.toLowerCase()),
      )
    : countries;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>
          {t('countriesHeading', {
            total: countries.length,
            active: countries.filter((c) => c.active).length,
          })}
        </CardTitle>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tAdmin('searchStates')}
          className="max-w-[16rem]"
          aria-label={tAdmin('searchStatesLabel')}
        />
      </CardHeader>
      <CardContent>
        <div className="scroll-x">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b">
                <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tTable('memberState')}</th>
                <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{t('colIso')}</th>
                <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tTable('region')}</th>
                <th scope="col" className="text-muted-foreground py-2 pe-3 text-end text-xs font-medium">{t('colUsers')}</th>
                <th scope="col" className="text-muted-foreground py-2 pe-3 text-end text-xs font-medium">{t('colSubmissions')}</th>
                <th scope="col" className="text-muted-foreground py-2 text-start text-xs font-medium">{tTable('status')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40 border-b last:border-0">
                  <td className="py-2.5 pr-3">
                    <Link href={`/countries/${c.iso2}`} className="hover:text-primary font-medium hover:underline">
                      {c.shortName}
                    </Link>
                    <span className="text-muted-foreground block text-xs">{c.name}</span>
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-xs">
                    {c.iso2} · {c.iso3}
                  </td>
                  <td className="py-2.5 pr-3">
                    <select
                      value={c.regionId}
                      onChange={(e) =>
                        apply(c.id, { regionId: e.target.value }, t('reassigned', { country: c.shortName }))
                      }
                      aria-label={t('regionFor', { country: c.shortName })}
                      className="border-input bg-background h-7 rounded-md border px-2 text-xs"
                    >
                      {regions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5 pr-3 text-right text-xs tnum">{c.userCount}</td>
                  <td className="py-2.5 pr-3 text-right text-xs tnum">{c.submissionCount}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      {c.active ? (
                        <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[0.65rem]">
                          {t('active')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[0.65rem]">{tAdmin('inactive')}</Badge>
                      )}
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                          apply(
                            c.id,
                            { active: !c.active },
                            c.active
                              ? t('deactivated', { country: c.shortName })
                              : t('reactivated', { country: c.shortName }),
                          )
                        }
                      >
                        {c.active ? t('deactivate') : t('reactivate')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
