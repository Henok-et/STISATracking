import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function SiteFooter() {
  const [t, tNav, tBrand, tLang] = await Promise.all([
    getTranslations('footer'),
    getTranslations('nav'),
    getTranslations('brand'),
    getTranslations('language'),
  ]);

  return (
    <footer className="mt-16 border-t">
      <div className="text-muted-foreground mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="space-y-2">
          <p className="text-foreground font-heading font-semibold">{tBrand('name')}</p>
          <p className="leading-relaxed">{t('blurb')}</p>
        </div>

        <div className="space-y-2">
          <p className="text-foreground font-medium">{t('explore')}</p>
          <ul className="space-y-1.5">
            <li><Link className="hover:text-foreground" href="/">{tNav('dashboard')}</Link></li>
            <li><Link className="hover:text-foreground" href="/countries">{tNav('countries')}</Link></li>
            <li><Link className="hover:text-foreground" href="/sectors">{tNav('sectors')}</Link></li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-foreground font-medium">{t('aboutData')}</p>
          <ul className="space-y-1.5">
            <li><Link className="hover:text-foreground" href="/methodology">{tNav('methodology')}</Link></li>
            <li><Link className="hover:text-foreground" href="/methodology#sources">{t('indicatorSources')}</Link></li>
            <li><Link className="hover:text-foreground" href="/methodology#missing-data">{t('missingData')}</Link></li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-foreground font-medium">{t('reporting')}</p>
          <ul className="space-y-1.5">
            <li><Link className="hover:text-foreground" href="/portal/login">{t('focalPointSignIn')}</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className="text-muted-foreground mx-auto max-w-7xl space-y-2 px-4 py-5 text-xs leading-relaxed sm:px-6">
          <p>{t('disclaimer')}</p>
          {/* Explains why indicator text stays in its original language even
              when the interface is translated. */}
          <p>{tLang('note')}</p>
        </div>
      </div>
    </footer>
  );
}
