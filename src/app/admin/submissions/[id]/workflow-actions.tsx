'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { transitionSubmission } from '@/lib/actions/workflow';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { TransitionLabelKey } from '@/lib/submissions/workflow';
import type { SubmissionStatus } from '@/generated/prisma/enums';

interface TransitionOption {
  to: SubmissionStatus;
  labelKey: TransitionLabelKey;
  requiresNote: boolean;
}

/**
 * Workflow controls.
 *
 * The options rendered come from the server's own state machine, so this
 * component cannot offer a transition the server would reject — and the server
 * re-validates the transition regardless of what is sent.
 */
export function WorkflowActions({
  submissionId,
  status,
  transitions,
}: {
  submissionId: string;
  status: SubmissionStatus;
  transitions: TransitionOption[];
}) {
  const router = useRouter();
  const t = useTranslations('review');
  const tLabel = useTranslations('transitions');
  const tStatus = useTranslations('status');
  const tCommon = useTranslations('common');
  const [, startTransition] = useTransition();
  const [pendingTo, setPendingTo] = useState<SubmissionStatus | null>(null);
  const [noteFor, setNoteFor] = useState<TransitionOption | null>(null);
  const [note, setNote] = useState('');

  async function run(option: TransitionOption, withNote?: string) {
    setPendingTo(option.to);
    try {
      const result = await transitionSubmission({
        submissionId,
        to: option.to,
        note: withNote,
      });

      if (!result.ok) {
        toast.error(t('actionFailed', { action: tLabel(option.labelKey) }), {
          description: result.error,
        });
        return;
      }

      if (result.data.blockingIssues?.length) {
        toast.error(t('blockedByReadiness'), {
          description: t('blockedByReadinessBody', {
            count: result.data.blockingIssues.length,
          }),
        });
        return;
      }

      toast.success(t('actionDone', { action: tLabel(option.labelKey) }));
      setNoteFor(null);
      setNote('');
      startTransition(() => router.refresh());
    } finally {
      setPendingTo(null);
    }
  }

  if (transitions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t('noFurtherActions', { status: tStatus(status) })}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {transitions.map((tr) => (
          <Button
            key={tr.to + tr.labelKey}
            variant={tr.to === 'PUBLISHED' || tr.to === 'APPROVED' ? 'default' : 'outline'}
            disabled={pendingTo !== null}
            onClick={() => (tr.requiresNote ? setNoteFor(tr) : run(tr))}
          >
            {pendingTo === tr.to ? <Loader2 className="size-4 animate-spin" /> : null}
            {tLabel(tr.labelKey)}
          </Button>
        ))}
      </div>

      {noteFor ? (
        <div className="space-y-2 rounded-lg border p-4">
          <Label htmlFor="transition-note">
            {t('noteLabel', { action: tLabel(noteFor.labelKey) })}{' '}
            <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="transition-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              noteFor.to === 'REVISION_REQUIRED'
                ? t('revisionNotePlaceholder')
                : t('auditNotePlaceholder')
            }
          />
          <div className="flex gap-2">
            <Button
              disabled={note.trim().length === 0 || pendingTo !== null}
              onClick={() => run(noteFor, note.trim())}
            >
              {pendingTo ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('confirm')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setNoteFor(null);
                setNote('');
              }}
            >
              {tCommon('cancel')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
