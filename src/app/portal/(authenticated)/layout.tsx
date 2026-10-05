import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { getTranslations } from 'next-intl/server';
import { currentActor } from '@/lib/auth/guards';
import { PortalShell } from '@/components/portal-shell';
import { AuthSessionProvider } from '@/components/auth-session-provider';

/**
 * Shell for the authenticated portal pages.
 *
 * `/portal/login` deliberately sits outside this route group so it is not
 * wrapped by an auth check that would redirect it to itself.
 *
 * Middleware already bounces anonymous traffic, but this layout re-checks the
 * session server-side: middleware is a convenience, not the security boundary.
 */
export default async function AuthenticatedPortalLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('portal');
  const NAV = [
    { href: '/portal', label: t('overview') },
    { href: '/portal/data-entry', label: t('dataEntry') },
    { href: '/portal/account', label: t('account') },
  ];

  const actor = await currentActor();
  if (!actor) redirect('/portal/login');

  // Administrators have their own area; sending them here would show a portal
  // with no assigned Member State.
  if (actor.role === 'ADMIN') redirect('/admin/overview');

  return (
    <AuthSessionProvider>
      <PortalShell
        actor={actor}
        nav={NAV}
        areaLabel={t('areaLabel')}
        contextLabel={actor.countryName ?? undefined}
      >
        {children}
      </PortalShell>
    </AuthSessionProvider>
  );
}
