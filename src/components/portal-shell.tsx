import Link from 'next/link';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { LogOut } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button-link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { logout } from '@/lib/actions/account';
import type { Actor } from '@/lib/auth/guards';

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Shared chrome for the two authenticated areas.
 *
 * The country badge is rendered from the session so a focal point can always
 * see which Member State they are acting for — the same value the server
 * guards enforce against.
 */
export async function PortalShell({
  actor,
  nav,
  areaLabel,
  contextLabel,
  children,
}: {
  actor: Actor;
  nav: NavItem[];
  areaLabel: string;
  contextLabel?: string;
  children: ReactNode;
}) {
  const t = await getTranslations('nav');

  return (
    <>
      <header className="glass sticky top-0 z-50 border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span
              aria-hidden
              className="bg-primary text-primary-foreground font-heading grid size-9 shrink-0 place-items-center rounded-md text-[0.62rem] font-bold tracking-tight"
            >
              ESTI
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="font-heading block text-sm font-semibold">STISA 2034</span>
              <span className="text-muted-foreground block text-[0.7rem]">{areaLabel}</span>
            </span>
          </Link>

          {contextLabel ? (
            <Badge variant="outline" className="border-primary/30 bg-primary/8 text-primary">
              {contextLabel}
            </Badge>
          ) : null}

          <div className="ms-auto flex items-center gap-2">
            <span className="text-muted-foreground hidden text-xs md:inline">{actor.email}</span>
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <ThemeToggle />
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut className="size-4" />
                <span className="hidden sm:inline">{t('signOut')}</span>
              </Button>
            </form>
          </div>
        </div>

        <nav aria-label={areaLabel} className="scroll-x border-t">
          <div className="mx-auto flex max-w-7xl gap-1 px-4 py-1.5 sm:px-6">
            {nav.map((item) => (
              <ButtonLink key={item.href} href={item.href} variant="ghost" size="sm" className="shrink-0">
                {item.label}
              </ButtonLink>
            ))}
          </div>
        </nav>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>
    </>
  );
}
