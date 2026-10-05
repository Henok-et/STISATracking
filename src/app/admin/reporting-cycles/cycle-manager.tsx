'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { updateReportingCycle, announceCycle } from '@/lib/actions/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface CycleRow {
  id: string;
  phase: string;
  reportingYear: number;
  implementationStartYear: number;
  implementationEndYear: number;
  label: string;
  status: string;
  active: boolean;
  opensAt: string;
  closesAt: string;
  submissionCount: number;
  notes: string | null;
}

const STATUSES = ['PLANNED', 'OPEN', 'CLOSED', 'ARCHIVED'] as const;

export function CycleManager({ cycles }: { cycles: CycleRow[] }) {
  const router = useRouter();
  const t = useTranslations('adminPages');
  const tCycleStatus = useTranslations('cycleStatus');
  const tCommon = useTranslations('common');
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [announcing, setAnnouncing] = useState<string | null>(null);

  async function onAnnounce(cycle: CycleRow) {
    // 55 Member States receive this, so it asks first.
    const confirmed = window.confirm(t('announceConfirm', { cycle: cycle.label }));
    if (!confirmed) return;

    setAnnouncing(cycle.id);
    try {
      const result = await announceCycle(cycle.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t('announceSent', { count: result.data.sent }), {
        description:
          result.data.failed > 0
            ? t('announceFailed', { count: result.data.failed })
            : t('announceRecorded'),
      });
    } finally {
      setAnnouncing(null);
    }
  }

  async function onSave(cycleId: string, formData: FormData) {
    setPending(true);
    try {
      const result = await updateReportingCycle({
        cycleId,
        opensAt: String(formData.get('opensAt') ?? ''),
        closesAt: String(formData.get('closesAt') ?? ''),
        status: String(formData.get('status') ?? ''),
        notes: String(formData.get('notes') ?? '') || null,
      });

      if (!result.ok) {
        toast.error(result.error, {
          description: Object.values(result.fieldErrors ?? {})[0]?.[0],
        });
        return;
      }
      toast.success(t('cycleUpdated'));
      setEditing(null);
      startTransition(() => router.refresh());
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {cycles.map((c) => (
        <Card key={c.id}>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {c.label}
                {c.active ? (
                  <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                    {t('active')}
                  </Badge>
                ) : null}
                <Badge variant="outline">{tCycleStatus(c.status as 'OPEN')}</Badge>
              </CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                {t('implementation', {
                  phase: c.phase === 'PHASE_1' ? t('phase1Short') : t('phase2Short'),
                  start: c.implementationStartYear,
                  end: c.implementationEndYear,
                  count: c.submissionCount,
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {c.active ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={announcing !== null}
                  onClick={() => onAnnounce(c)}
                >
                  {announcing === c.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {t('announceToFocalPoints')}
                </Button>
              ) : null}
              <Button
                variant={editing === c.id ? 'ghost' : 'outline'}
                size="sm"
                onClick={() => setEditing(editing === c.id ? null : c.id)}
              >
                {editing === c.id ? tCommon('cancel') : t('editWindow')}
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {editing === c.id ? (
              <form action={(fd) => onSave(c.id, fd)} className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor={`opensAt-${c.id}`}>{t('opens')}</Label>
                  <Input id={`opensAt-${c.id}`} name="opensAt" type="date" defaultValue={c.opensAt} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`closesAt-${c.id}`}>{t('closes')}</Label>
                  <Input id={`closesAt-${c.id}`} name="closesAt" type="date" defaultValue={c.closesAt} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`status-${c.id}`}>{tCommon('status')}</Label>
                  <select
                    id={`status-${c.id}`}
                    name="status"
                    defaultValue={c.status}
                    className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {tCycleStatus(s as 'OPEN')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-3">
                  <Label htmlFor={`notes-${c.id}`}>{tCommon('notes')}</Label>
                  <Textarea id={`notes-${c.id}`} name="notes" rows={2} defaultValue={c.notes ?? ''} />
                </div>
                <div className="sm:col-span-3">
                  <Button type="submit" disabled={pending}>
                    {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                    {t('saveCycle')}
                  </Button>
                  <p className="text-muted-foreground mt-2 text-xs">{t('onlyOneOpen')}</p>
                </div>
              </form>
            ) : (
              <dl className="grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground text-xs">{t('opens')}</dt>
                  <dd className="mt-0.5 tnum">{c.opensAt}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">{t('closes')}</dt>
                  <dd className="mt-0.5 tnum">{c.closesAt}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">{t('reportingYearLabel')}</dt>
                  <dd className="mt-0.5 tnum">{c.reportingYear}</dd>
                </div>
                {c.notes ? (
                  <div className="sm:col-span-3">
                    <dt className="text-muted-foreground text-xs">{tCommon('notes')}</dt>
                    <dd className="mt-0.5 leading-relaxed">{c.notes}</dd>
                  </div>
                ) : null}
              </dl>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
