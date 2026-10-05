import type { Metadata } from 'next';

import { getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { requireAdminOrRedirect } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { SectionHeading } from '@/components/data-display';
import { Reveal } from '@/components/reveal';

export const metadata: Metadata = {
  title: 'Audit log',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 60;

/** `labelKey` indexes the `adminPages` message section. */
const ACTION_GROUPS = [
  { key: 'ALL', labelKey: 'groupAll' },
  {
    key: 'AUTH',
    labelKey: 'groupAuth',
    actions: ['LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT'],
  },
  {
    key: 'DATA',
    labelKey: 'groupData',
    actions: ['SUBMISSION_VALUE_CHANGED', 'SUBMISSION_CREATED'],
  },
  {
    key: 'WORKFLOW',
    labelKey: 'groupWorkflow',
    actions: [
      'SUBMISSION_SUBMITTED',
      'SUBMISSION_REVIEW_STARTED',
      'SUBMISSION_REVISION_REQUESTED',
      'SUBMISSION_APPROVED',
      'SUBMISSION_PUBLISHED',
      'SUBMISSION_UNPUBLISHED',
      'SUBMISSION_UNLOCKED',
    ],
  },
  {
    key: 'ADMIN',
    labelKey: 'groupAdmin',
    actions: [
      'USER_CREATED',
      'USER_UPDATED',
      'USER_DEACTIVATED',
      'USER_COUNTRY_ASSIGNED',
      'USER_PASSWORD_RESET',
      'INDICATOR_CREATED',
      'INDICATOR_UPDATED',
      'INDICATOR_DEACTIVATED',
      'INDICATOR_VERSION_CREATED',
      'COUNTRY_UPDATED',
      'REPORTING_CYCLE_CREATED',
      'REPORTING_CYCLE_UPDATED',
    ],
  },
] as const;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; page?: string }>;
}) {
  const [t, tAdmin] = await Promise.all([
    getTranslations('adminPages'),
    getTranslations('admin'),
  ]);

  await requireAdminOrRedirect('/admin/audit-log');
  const { group = 'ALL', page = '1' } = await searchParams;

  const pageNum = Math.max(1, Number(page) || 1);
  const selected = ACTION_GROUPS.find((g) => g.key === group) ?? ACTION_GROUPS[0];
  const actionFilter =
    'actions' in selected && selected.actions
      ? { action: { in: [...selected.actions] as never } }
      : {};

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: actionFilter,
      include: {
        user: { select: { name: true, email: true } },
        country: { select: { shortName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where: actionFilter }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Reveal>
        <SectionHeading
          className="mb-6"
          title={tAdmin('auditLog')}
          description={t('auditDescription')}
        />
      </Reveal>

      <Reveal>
        <div className="mb-6 flex flex-wrap gap-2">
          {ACTION_GROUPS.map((g) => (
            <ButtonLink
              key={g.key}
              href={`/admin/audit-log?group=${g.key}`}
              size="sm"
              variant={g.key === selected.key ? 'default' : 'outline'}
            >
              {t(g.labelKey)}
            </ButtonLink>
          ))}
        </div>
      </Reveal>

      <Reveal>
        <Card>
          <CardHeader>
            <CardTitle>{t('recordCount', { count: total })}</CardTitle>
            <CardDescription>{t('showingPage', { page: pageNum, pages })}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="scroll-x">
              <table className="w-full min-w-[56rem] text-sm">
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{t('colWhen')}</th>
                    <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{t('colAction')}</th>
                    <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{t('colActor')}</th>
                    <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{t('colEntity')}</th>
                    <th scope="col" className="text-muted-foreground py-2 text-start text-xs font-medium">{t('colChange')}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b align-top last:border-0">
                      <td className="text-muted-foreground py-2.5 pr-3 text-xs whitespace-nowrap tnum">
                        {e.createdAt.toISOString().replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="outline" className="text-[0.65rem] whitespace-nowrap">
                          {e.action.replace(/_/g, ' ').toLowerCase()}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-xs">
                        {e.user?.name ?? e.actorEmail ?? tAdmin('system')}
                        {e.actorRole ? (
                          <span className="text-muted-foreground block">
                            {e.actorRole.toLowerCase().replace('_', ' ')}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3 text-xs">
                        {e.entity}
                        {e.country ? (
                          <span className="text-muted-foreground block">{e.country.shortName}</span>
                        ) : null}
                        {e.metadata &&
                        typeof e.metadata === 'object' &&
                        'indicatorCode' in e.metadata ? (
                          <span className="block font-mono">
                            {String((e.metadata as Record<string, unknown>).indicatorCode)}
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-md py-2.5 text-xs">
                        <ChangeCell oldValue={e.oldValue} newValue={e.newValue} />
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground py-10 text-center text-sm">
                        {t('noAuditRecords')}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {pages > 1 ? (
              <div className="mt-6 flex items-center justify-between gap-3">
                <ButtonLink
                  href={`/admin/audit-log?group=${selected.key}&page=${pageNum - 1}`}
                  size="sm"
                  variant="outline"
                  aria-disabled={pageNum <= 1}
                  className={pageNum <= 1 ? 'pointer-events-none opacity-50' : ''}
                >
                  {t('previous')}
                </ButtonLink>
                <span className="text-muted-foreground text-xs tnum">
                  {t('pageOf', { page: pageNum, pages })}
                </span>
                <ButtonLink
                  href={`/admin/audit-log?group=${selected.key}&page=${pageNum + 1}`}
                  size="sm"
                  variant="outline"
                  aria-disabled={pageNum >= pages}
                  className={pageNum >= pages ? 'pointer-events-none opacity-50' : ''}
                >
                  {t('next')}
                </ButtonLink>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

/** Renders the before/after pair compactly, showing only fields that changed. */
function ChangeCell({ oldValue, newValue }: { oldValue: unknown; newValue: unknown }) {
  const t = useTranslations('adminPages');
  if (!newValue || typeof newValue !== 'object') {
    return <span className="text-muted-foreground">—</span>;
  }

  const after = newValue as Record<string, unknown>;
  const before = (oldValue ?? {}) as Record<string, unknown>;

  const changed = Object.keys(after).filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
  );

  if (changed.length === 0) return <span className="text-muted-foreground">—</span>;

  return (
    <ul className="space-y-0.5">
      {changed.slice(0, 5).map((k) => (
        <li key={k} className="font-mono text-[0.68rem] leading-relaxed">
          <span className="text-muted-foreground">{k}:</span>{' '}
          <span className="text-muted-foreground line-through">{fmt(before[k])}</span>{' '}
          <span aria-hidden>→</span> <span>{fmt(after[k])}</span>
        </li>
      ))}
      {changed.length > 5 ? (
        <li className="text-muted-foreground text-[0.68rem]">
          {t('andMoreFields', { count: changed.length - 5 })}
        </li>
      ) : null}
    </ul>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  const s = String(v);
  return s.length > 40 ? `${s.slice(0, 38)}…` : s;
}
