import type { Metadata } from 'next';

import { getTranslations } from 'next-intl/server';
import { requireAdminOrRedirect } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SectionHeading } from '@/components/data-display';
import { Reveal } from '@/components/reveal';
import { UserManager } from './user-manager';

export const metadata: Metadata = {
  title: 'Users',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const t = await getTranslations('adminPages');

  await requireAdminOrRedirect('/admin/users');

  const [users, countries] = await Promise.all([
    prisma.user.findMany({
      include: { country: { select: { shortName: true, iso2: true } } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    }),
    prisma.country.findMany({
      where: { active: true },
      select: { id: true, shortName: true, iso2: true },
      orderBy: { shortName: 'asc' },
    }),
  ]);

  const countriesWithoutFocalPoint = countries.filter(
    (c) => !users.some((u) => u.countryId === c.id && u.role === 'FOCAL_POINT' && u.active),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Reveal>
        <SectionHeading
          className="mb-6"
          title={t('usersTitle')}
          description={t('usersDescription')}
        />
      </Reveal>

      {countriesWithoutFocalPoint.length > 0 ? (
        <Reveal>
          <Card className="border-warning/40 bg-warning/8 mb-6">
            <CardContent className="p-4 text-sm">
              <p className="font-medium">
                {t('noFocalPointHeading', { count: countriesWithoutFocalPoint.length })}
              </p>
              <p className="text-muted-foreground mt-1 leading-relaxed">
                {countriesWithoutFocalPoint.map((c) => c.shortName).join(', ')}
              </p>
            </CardContent>
          </Card>
        </Reveal>
      ) : null}

      <Reveal>
        <UserManager
          countries={countries}
          users={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            active: u.active,
            countryId: u.countryId,
            countryName: u.country?.shortName ?? null,
            organisation: u.organisation,
            lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
            mustChangePassword: u.mustChangePassword,
          }))}
        />
      </Reveal>

      <Reveal>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t('accessModel')}</CardTitle>
            <CardDescription>{t('accessModelDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              <Badge variant="outline" className="me-2">
                {t('focalPointRole')}
              </Badge>
              {t('focalPointScope')}
            </p>
            <p>
              <Badge variant="outline" className="me-2">
                {t('administratorRole')}
              </Badge>
              {t('administratorScope')}
            </p>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
