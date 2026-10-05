'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { importWorkbook, type ImportPreview } from '@/lib/actions/import';
import { Button } from '@/components/ui/button';
import { AnchorButton } from '@/components/ui/button-link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

/**
 * Download-complete-upload, as an alternative to filling 75 indicators by hand.
 *
 * The upload is always previewed first. A focal point sees every value that
 * would change and every value that failed validation before anything is
 * written — importing a spreadsheet into an institutional record should never
 * be a single irreversible click.
 */
export function WorkbookImport({
  submissionId,
  editable,
}: {
  submissionId: string;
  editable: boolean;
}) {
  const router = useRouter();
  const t = useTranslations('portal.import');
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState<'idle' | 'previewing' | 'applying'>('idle');

  async function run(apply: boolean) {
    if (!file) return;
    setBusy(apply ? 'applying' : 'previewing');
    try {
      const fd = new FormData();
      fd.set('submissionId', submissionId);
      fd.set('apply', String(apply));
      fd.set('file', file);

      const result = await importWorkbook(fd);
      if (!result.ok) {
        toast.error(t('importFailed'), { description: result.error });
        return;
      }

      setPreview(result.data);

      if (apply) {
        toast.success(t('importedToast', { count: result.data.totals.willWrite }), {
          description:
            result.data.issues.length > 0
              ? t('importedRejected', { count: result.data.issues.length })
              : t('importedAllPassed'),
        });
        setFile(null);
        if (inputRef.current) inputRef.current.value = '';
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy('idle');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="size-4" aria-hidden />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <AnchorButton href="/api/portal/template" variant="secondary" size="sm">
            <Download className="size-4" />
            {t('download')}
          </AnchorButton>

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            disabled={!editable}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
            }}
            className="text-muted-foreground file:bg-secondary file:text-secondary-foreground max-w-xs text-xs file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-medium"
            aria-label={t('selectWorkbook')}
          />

          <Button
            size="sm"
            variant="outline"
            disabled={!file || !editable || busy !== 'idle'}
            onClick={() => run(false)}
          >
            {busy === 'previewing' ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {t('check')}
          </Button>

          {preview && !preview.applied && preview.totals.willWrite > 0 ? (
            <Button size="sm" disabled={busy !== 'idle'} onClick={() => run(true)}>
              {busy === 'applying' ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('apply', { count: preview.totals.willWrite })}
            </Button>
          ) : null}
        </div>

        {!editable ? (
          <p className="text-muted-foreground text-xs">{t('locked')}</p>
        ) : null}

        {preview ? <PreviewPanel preview={preview} /> : null}
      </CardContent>
    </Card>
  );
}

function PreviewPanel({ preview }: { preview: ImportPreview }) {
  const t = useTranslations('portal.import');
  const tTable = useTranslations('table');
  const hasProblems = preview.fileErrors.length > 0 || preview.issues.length > 0;

  return (
    <div className="space-y-3">
      {preview.fileErrors.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>{t('problemWithFile')}</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-0.5 text-xs">
              {preview.fileErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline">{t('rowsRead', { count: preview.totals.rowsRead })}</Badge>
        <Badge variant="outline" className={preview.applied ? 'border-success/40 bg-success/10 text-success' : ''}>
          {preview.applied
            ? t('written', { count: preview.totals.willWrite })
            : t('wouldChange', { count: preview.totals.willWrite })}
        </Badge>
        {preview.unchanged > 0 ? (
          <Badge variant="outline">{t('alreadyMatch', { count: preview.unchanged })}</Badge>
        ) : null}
        {preview.issues.length > 0 ? (
          <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning-foreground">
            {t('rejected', { count: preview.issues.length })}
          </Badge>
        ) : null}
        {preview.totals.completenessPct !== undefined ? (
          <Badge variant="outline">
            {t('completePct', { percent: preview.totals.completenessPct.toFixed(0) })}
          </Badge>
        ) : null}
      </div>

      {preview.applied && !hasProblems ? (
        <Alert className="border-success/40 bg-success/8">
          <CheckCircle2 className="size-4" />
          <AlertDescription>{t('appliedNote')}</AlertDescription>
        </Alert>
      ) : null}

      {preview.issues.length > 0 ? (
        <div className="border-warning/40 bg-warning/8 rounded-lg border p-3">
          <p className="text-sm font-medium">
            {t('rejectedHeading', { count: preview.issues.length })}
          </p>
          <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto text-xs">
            {preview.issues.map((i, idx) => (
              <li key={idx} className="text-muted-foreground">
                <span className="text-foreground font-mono">{i.code}</span>
                <span className="ml-1">{t('rowLabel', { row: i.rowNumber })}</span> — {i.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview.changes.length > 0 ? (
        <div className="rounded-lg border">
          <p className="border-b px-3 py-2 text-sm font-medium">
            {preview.applied ? t('valuesWritten') : t('valuesWouldChange')}
          </p>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th scope="col" className="px-3 py-1.5 text-left font-medium">{tTable('code')}</th>
                  <th scope="col" className="px-3 py-1.5 text-left font-medium">{tTable('indicator')}</th>
                  <th scope="col" className="px-3 py-1.5 text-left font-medium">{t('from')}</th>
                  <th scope="col" className="px-3 py-1.5 text-left font-medium">{t('to')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.changes.map((c) => (
                  <tr key={c.code} className="border-t align-top">
                    <td className="px-3 py-1.5 font-mono whitespace-nowrap">{c.code}</td>
                    <td className="max-w-xs px-3 py-1.5 leading-snug">{c.indicatorName}</td>
                    <td className="text-muted-foreground px-3 py-1.5 whitespace-nowrap">{c.before}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{c.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
