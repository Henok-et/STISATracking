import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LogIn } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button-link';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { currentActor } from '@/lib/auth/guards';

export async function SiteHeader() {
  const [actor, t, tBrand] = await Promise.all([
    currentActor(),
    getTranslations('nav'),
    getTranslations('brand'),
  ]);

  const nav = [
    { href: '/', label: t('dashboard') },
    { href: '/countries', label: t('countries') },
    { href: '/sectors', label: t('sectors') },
    { href: '/methodology', label: t('methodology') },
  ];

  const portalHref = actor
    ? actor.role === 'ADMIN'
      ? '/admin/overview'
      : '/portal'
    : '/portal/login';
  const portalLabel = actor
    ? actor.role === 'ADMIN'
      ? t('administration')
      : t('portal')
    : t('signIn');

  return (
    <header className="glass sticky top-0 z-50 border-b">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="grad-primary text-primary-foreground font-heading grid size-9 shrink-0 place-items-center rounded-md text-[0.62rem] font-bold tracking-tight shadow-sm"
          >
            {tBrand('mark')}
          </span>
          <span className="leading-tight">
            <span className="font-heading block text-sm font-semibold">{tBrand('name')}</span>
            <span className="text-muted-foreground block text-[0.7rem]">{tBrand('tagline')}</span>
          </span>
        </Link>

        <nav aria-label={t('dashboard')} className="ms-auto hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <ButtonLink key={item.href} href={item.href} variant="ghost" size="sm">
              {item.label}
            </ButtonLink>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-1 md:ms-0">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <ThemeToggle />
          <ButtonLink href={portalHref} size="sm" variant={actor ? 'secondary' : 'default'}>
            <LogIn className="size-4" />
            <span className="hidden sm:inline">{portalLabel}</span>
          </ButtonLink>
        </div>
      </div>

      {/* Compact nav for small screens, kept out of the main bar. */}
      <nav aria-label={t('dashboard')} className="scroll-x border-t bg-primary/5 md:hidden">
        <div className="flex items-center gap-1 px-4 py-1.5">
          {nav.map((item) => (
            <ButtonLink
              key={item.href}
              href={item.href}
              variant="ghost"
              size="sm"
              className="shrink-0"
            >
              {item.label}
            </ButtonLink>
          ))}
          <LanguageSwitcher className="ms-auto shrink-0 sm:hidden" />
        </div>
      </nav>
    </header>
  );
}
