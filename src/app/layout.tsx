import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono, Source_Serif_4, Noto_Sans_Arabic } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { DemoBanner } from '@/components/demo-banner';
import { localeDir } from '@/i18n/config';
import './globals.css';

const sans = Geist({ variable: '--font-sans', subsets: ['latin'], display: 'swap' });
const mono = Geist_Mono({ variable: '--font-mono', subsets: ['latin'], display: 'swap' });
// A serif for headings gives the institutional register the platform needs
// without costing legibility in dense tables, which stay in the sans face.
const serif = Source_Serif_4({
  variable: '--font-heading',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '600', '700'],
});
// Geist has no Arabic coverage, so Arabic would otherwise fall back to whatever
// the operating system provides — inconsistent, and often poorly hinted.
const arabic = Noto_Sans_Arabic({
  variable: '--font-arabic',
  subsets: ['arabic'],
  display: 'swap',
  weight: ['400', '600', '700'],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard');
  return {
    title: {
      default: 'STISA 2034 — Monitoring & Evaluation Platform',
      template: '%s · STISA 2034',
    },
    description: t('intro'),
    applicationName: 'STISA 2034 M&E Platform',
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdfcfb' },
    { media: '(prefers-color-scheme: dark)', color: '#231b1d' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const dir = localeDir(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} ${serif.variable} ${arabic.variable} h-full`}
    >
      {/*
        Browser extensions commonly write attributes onto <body> before React
        hydrates — Grammarly adds data-gr-ext-installed and
        data-new-gr-c-s-check-loaded, password managers and translators do
        similar. The server never emits them, so React reports a mismatch it
        can do nothing about.

        suppressHydrationWarning is scoped to THIS element's own attributes and
        one level of text. It does not hide mismatches in any child, so a real
        hydration bug elsewhere in the tree is still reported.
      */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <NextIntlClientProvider>
          <ThemeProvider>
            {/* Keyboard users must be able to skip the navigation. */}
            <SkipLink />
            <DemoBanner />
            {children}
            <Toaster position="top-right" richColors closeButton />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

async function SkipLink() {
  const t = await getTranslations('nav');
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-100 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
    >
      {t('skipToContent')}
    </a>
  );
}
