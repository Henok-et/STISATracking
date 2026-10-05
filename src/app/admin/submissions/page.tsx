import type { Metadata } from 'next';
import Link from 'next/link';
import { FileDown } from 'lucide-react';

import { getLocale, getTranslations } from 'next-intl/server';
import { requireAdminOrRedirect } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getAllCycles } from '@/lib/reporting/cycles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AnchorButton, ButtonLink } from '@/components/ui/button-link';
import { StatusBadge, Meter, SectionHeading } from '@/components/data-display';
import { Reveal } from '@/components/reveal';

export const metadata: Metadata = {
  title: 'Submissions',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; status?: string }>;
}) {
  const [t, tStatus, tTable, tAdmin, locale] = await Promise.all([
    getTranslations('review'),
    getTranslations('status'),
    getTranslations('table'),
    getTranslations('admin'),
    getLocale(),
  ]);

  await requireAdminOrRedirect('/admin/submissions');
  const { year, status } = await searchParams;

  const cycles = await getAllCycles();
  const requestedYear = year ? Number(year) : undefined;

  const submissions = await prisma.submission.findMany({
    where: {
      ...(Number.isFinite(requestedYear)
        ? { reportingCycle: { reportingYear: requestedYear } }
        : {}),
      ...(status && status !== 'ALL'
        ? {
            status: status as
              | 'DRAFT'
              | 'SUBMITTED'
              | 'UNDER_REVIEW'
              | 'REVISION_REQUIRED'
              | 'APPROVED'
              | 'PUBLISHED',
          }
        : {}),
    },
    include: {
      country: { include: { region: true } },
      reportingCycle: true,
      submittedBy: { select: { name: true, email: true } },
    },
    orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
  });

  const STATUSES = [
    'ALL',
    'SUBMITTED',
    'UNDER_REVIEW',
    'REVISION_REQUIRED',
    'APPROVED',
    'PUBLISHED',
    'DRAFT',
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Reveal>
        <SectionHeading
          className="mb-6"
          title={tAdmin('submissions')}
          description={t('listDescription')}
          action={
            <AnchorButton
              variant="secondary"
              size="sm"
              href={`/api/v1/admin/exports/submissions${requestedYear ? `?year=${requestedYear}` : ''}`}
            >
              <FileDown className="size-4" />
              {t('exportDataset')}
            </AnchorButton>
          }
        />
      </Reveal>

      <Reveal>
        <div className="mb-6 flex flex-wrap gap-2">
          {cycles.map((c) => (
            <ButtonLink
              key={c.id}
              href={`/admin/submissions?year=${c.reportingYear}${status ? `&status=${status}` : ''}`}
              size="sm"
              variant={c.reportingYear === requestedYear ? 'default' : 'outline'}
            >
              {c.reportingYear}
            </ButtonLink>
          ))}
          <ButtonLink
            href={`/admin/submissions${status ? `?status=${status}` : ''}`}
            size="sm"
            variant={requestedYear ? 'outline' : 'default'}
          >
            {t('allCycles')}
          </ButtonLink>
        </div>
      </Reveal>

      <Reveal>
        <div className="mb-6 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <ButtonLink
              key={s}
              href={`/admin/submissions?status=${s}${requestedYear ? `&year=${requestedYear}` : ''}`}
              size="sm"
              variant={(status ?? 'ALL') === s ? 'secondary' : 'ghost'}
            >
              {s === 'ALL' ? t('allStatuses') : tStatus(s as 'DRAFT')}
            </ButtonLink>
          ))}
        </div>
      </Reveal>

      <Reveal>
        <Card>
          <CardHeader>
            <CardTitle>{t('countTitle', { count: submissions.length })}</CardTitle>
            <CardDescription>{t('countDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="scroll-x">
              <table className="w-full min-w-[52rem] text-sm">
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tTable('memberState')}</th>
                    <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{t('cycle')}</th>
                    <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tTable('status')}</th>
                    <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tTable('completeness')}</th>
                    <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{t('submitted')}</th>
                    <th scope="col" className="text-muted-foreground py-2 text-left text-xs font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/40 border-b last:border-0">
                      <td className="py-2.5 pr-3">
                        <span className="font-medium">{s.country.shortName}</span>
                        <span className="text-muted-foreground block text-xs">
                          {s.country.region.name}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs tnum">{s.reportingCycle.reportingYear}</td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="w-40 py-2.5 pr-3">
                        <Meter
                          value={Number(s.completenessPct)}
                          label={`${Number(s.completenessPct).toFixed(0)}% · ${s.reportedCount}/${s.expectedCount}`}
                        />
                      </td>
                      <td className="text-muted-foreground py-2.5 pr-3 text-xs">
                        {s.submittedAt
                          ? s.submittedAt.toLocaleDateString(locale, { timeZone: 'UTC' })
                          : '—'}
                        {s.submittedBy ? (
                          <span className="block">{s.submittedBy.name}</span>
                        ) : null}
                      </td>
                      <td className="py-2.5">
                        <Link
                          href={`/admin/submissions/${s.id}`}
                          className="text-primary text-xs hover:underline"
                        >
                          {t('reviewLink')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {submissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-muted-foreground py-10 text-center text-sm">
                        {t('noSubmissionsMatch')}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
