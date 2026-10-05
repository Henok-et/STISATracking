import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ShieldCheck } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Secure sign in for STISA 2034 national focal points and AU administrators.',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const t = await getTranslations('auth');
  const tBrand = await getTranslations('brand');

  return (
    <main id="main" className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span
              aria-hidden
              className="bg-primary text-primary-foreground font-heading grid size-10 place-items-center rounded-md text-[0.62rem] font-bold tracking-tight"
            >
              {tBrand('mark')}
            </span>
            <span className="leading-tight">
              <span className="font-heading block text-sm font-semibold">{tBrand('name')}</span>
              <span className="text-muted-foreground block text-xs">{tBrand('tagline')}</span>
            </span>
          </Link>
          <ThemeToggle />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t('signInTitle')}</CardTitle>
            <CardDescription>
              {t('signInSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm callbackUrl={callbackUrl} />
          </CardContent>
        </Card>

        <p className="text-muted-foreground mt-6 flex items-start gap-2 text-xs leading-relaxed">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {t('securityNote')}
          </span>
        </p>

        <p className="text-muted-foreground mt-4 text-xs">
          <Link href="/" className="hover:text-foreground underline underline-offset-4">
            {t('returnPublic')}
          </Link>
        </p>
      </div>
    </main>
  );
}
