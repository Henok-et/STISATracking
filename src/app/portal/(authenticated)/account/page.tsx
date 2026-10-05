import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireActorOrRedirect } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Reveal } from '@/components/reveal';
import { ChangePasswordForm } from '@/components/change-password-form';

export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const [t, locale] = await Promise.all([getTranslations('account'), getLocale()]);
  const actor = await requireActorOrRedirect('/portal/account');

  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    include: { country: { include: { region: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-8 text-2xl font-semibold sm:text-3xl">{t('title')}</h1>

      <div className="space-y-6">
        <Reveal>
          <Card>
            <CardHeader>
              <CardTitle>{t('yourDetails')}</CardTitle>
              <CardDescription>{t('yourDetailsDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail label={t('name')} value={user?.name ?? actor.name} />
                <Detail label={t('email')} value={actor.email} />
                <Detail
                  label={t('role')}
                  value={actor.role === 'ADMIN' ? t('roleAdmin') : t('roleFocalPoint')}
                />
                <Detail
                  label={t('assignedState')}
                  value={
                    user?.country
                      ? `${user.country.shortName} · ${user.country.region.name}`
                      : t('continental')
                  }
                />
                {user?.organisation ? (
                  <Detail label={t('organisation')} value={user.organisation} />
                ) : null}
                <Detail
                  label={t('lastSignIn')}
                  value={
                    user?.lastLoginAt
                      ? user.lastLoginAt.toLocaleString(locale, { timeZone: 'UTC' }) + ' UTC'
                      : '—'
                  }
                />
              </dl>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal>
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {t('password')}
                {actor.mustChangePassword ? (
                  <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning-foreground">
                    {t('changeRequired')}
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>{t('passwordRule')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}
