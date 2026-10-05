import type { Metadata } from 'next';

import { getTranslations } from 'next-intl/server';
import { requireAdminOrRedirect } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionHeading } from '@/components/data-display';
import { Reveal } from '@/components/reveal';
import { CountryManager } from './country-manager';

export const metadata: Metadata = {
  title: 'Member States',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminCountriesPage() {
  const t = await getTranslations('adminPages');

  await requireAdminOrRedirect('/admin/countries');

  const [countries, regions] = await Promise.all([
    prisma.country.findMany({
      include: {
        region: true,
        _count: { select: { users: true, submissions: true } },
      },
      orderBy: [{ region: { sortOrder: 'asc' } }, { shortName: 'asc' }],
    }),
    prisma.region.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  const byRegion = regions.map((r) => ({
    ...r,
    count: countries.filter((c) => c.regionId === r.id).length,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Reveal>
        <SectionHeading
          className="mb-6"
          title={t('countriesTitle')}
          description={t('countriesDescription')}
        />
      </Reveal>

      <Reveal>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('regionalDistribution')}</CardTitle>
            <CardDescription>{t('regionalDistributionDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {byRegion.map((r) => (
                <div key={r.id} className="rounded-lg border p-4 text-center">
                  <p className="font-heading text-2xl font-semibold tnum">{r.count}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">{r.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal>
        <CountryManager
          regions={regions.map((r) => ({ id: r.id, name: r.name }))}
          countries={countries.map((c) => ({
            id: c.id,
            name: c.name,
            shortName: c.shortName,
            iso2: c.iso2,
            iso3: c.iso3,
            regionId: c.regionId,
            regionName: c.region.name,
            active: c.active,
            userCount: c._count.users,
            submissionCount: c._count.submissions,
          }))}
        />
      </Reveal>
    </div>
  );
}
