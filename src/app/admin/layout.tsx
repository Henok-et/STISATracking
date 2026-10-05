import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { getTranslations } from 'next-intl/server';
import { currentActor } from '@/lib/auth/guards';
import { roleHas } from '@/lib/auth/permissions';
import { PortalShell } from '@/components/portal-shell';
import { AuthSessionProvider } from '@/components/auth-session-provider';

/**
 * Administration shell.
 *
 * Re-checks the session and the capability server-side on every request.
 * Middleware performs the same check first, but middleware is a convenience —
 * this layout is the boundary that actually protects the pages.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('admin');
  const NAV = [
    { href: '/admin/overview', label: t('overview') },
    { href: '/admin/submissions', label: t('submissions') },
    { href: '/admin/countries', label: t('countries') },
    { href: '/admin/users', label: t('users') },
    { href: '/admin/indicators', label: t('indicators') },
    { href: '/admin/reporting-cycles', label: t('cycles') },
    { href: '/admin/audit-log', label: t('auditLog') },
    { href: '/admin/account', label: t('account') },
  ];

  const actor = await currentActor();
  if (!actor) redirect('/portal/login?callbackUrl=/admin/overview');
  if (!roleHas(actor.role, 'submission:viewAny')) redirect('/portal');

  return (
    <AuthSessionProvider>
      <PortalShell
        actor={actor}
        nav={NAV}
        areaLabel={t('areaLabel')}
        contextLabel={t('continental')}
      >
        {children}
      </PortalShell>
    </AuthSessionProvider>
  );
}
