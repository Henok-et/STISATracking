'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Loader2, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { updateIndicatorDefinition, setIndicatorActive } from '@/lib/actions/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const DATA_TYPES = [
  'INTEGER',
  'DECIMAL',
  'PERCENTAGE',
  'CURRENCY',
  'BOOLEAN',
  'TEXT',
  'URL',
  'CATEGORICAL',
] as const;
const METHODS = [
  'PERCENTAGE_CHANGE',
  'PERCENTAGE_POINT_CHANGE',
  'ABSOLUTE_COUNT',
  'ABSOLUTE_VALUE',
  'SHARE_OF_TOTAL',
  'INDEX_SCORE',
  'RATIO',
  'BINARY_ACHIEVEMENT',
  'CUSTOM',
  'UNDEFINED',
] as const;
const DIRECTIONS = [
  'HIGHER_IS_BETTER',
  'LOWER_IS_BETTER',
  'TARGET_IS_BETTER',
  'NOT_APPLICABLE',
] as const;

interface IndicatorRow {
  id: string;
  code: string;
  officialName: string;
  sourceText: string;
  definition: string | null;
  unit: string;
  dataType: string;
  calculationMethod: string;
  direction: string;
  unitProvenance: string;
  dataTypeProvenance: string;
  calculationProvenance: string;
  flags: string[];
  ambiguityNote: string | null;
  relatedCodes: string[];
  required: boolean;
  sourceRequired: boolean;
  active: boolean;
  currentVersion: number;
  sourcePage: number;
  valueCount: number;
}

interface SectorGroup {
  code: string;
  name: string;
  resultLevel: string;
  indicators: IndicatorRow[];
}

export function IndicatorManager({
  sectors,
  totals,
}: {
  sectors: SectorGroup[];
  totals: { indicators: number; active: number; withData: number };
}) {
  const router = useRouter();
  const t = useTranslations('adminPages');
  const tCommon = useTranslations('common');
  const tTable = useTranslations('table');
  const tMethod = useTranslations('method');
  const tDataType = useTranslations('dataType');
  const tDirection = useTranslations('direction');
  const tProvenance = useTranslations('provenance');
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<IndicatorRow | null>(null);
  const [pending, setPending] = useState(false);
  const [openSectors, setOpenSectors] = useState<Set<string>>(new Set([sectors[0]?.code ?? '']));

  const refresh = () => startTransition(() => router.refresh());

  const filtered = useMemo(() => {
    if (!query) return sectors;
    const q = query.toLowerCase();
    return sectors
      .map((s) => ({
        ...s,
        indicators: s.indicators.filter(
          (i) =>
            i.code.toLowerCase().includes(q) ||
            i.sourceText.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q),
        ),
      }))
      .filter((s) => s.indicators.length > 0);
  }, [sectors, query]);

  async function onSave(formData: FormData) {
    if (!editing) return;
    setPending(true);
    try {
      const result = await updateIndicatorDefinition({
        indicatorId: editing.id,
        changeReason: String(formData.get('changeReason') ?? ''),
        definition: String(formData.get('definition') ?? '') || null,
        unit: String(formData.get('unit') ?? ''),
        dataType: String(formData.get('dataType') ?? ''),
        calculationMethod: String(formData.get('calculationMethod') ?? ''),
        direction: String(formData.get('direction') ?? ''),
        required: formData.get('required') === 'on',
        sourceRequired: formData.get('sourceRequired') === 'on',
        ambiguityNote: String(formData.get('ambiguityNote') ?? '') || null,
      });

      if (!result.ok) {
        toast.error(result.error, { description: Object.values(result.fieldErrors ?? {})[0]?.[0] });
        return;
      }

      toast.success(t('versionCreated', { version: result.data.version }), {
        description: result.data.hadData ? t('versionPinned') : t('versionNoData'),
      });
      setEditing(null);
      refresh();
    } finally {
      setPending(false);
    }
  }

  async function toggleActive(indicator: IndicatorRow) {
    const reason = window.prompt(
      t('reasonPrompt', {
        action: indicator.active ? t('actionDeactivating') : t('actionReactivating'),
        code: indicator.code,
      }),
    );
    if (!reason || reason.trim().length < 5) {
      if (reason !== null) toast.error(t('reasonTooShort'));
      return;
    }
    const result = await setIndicatorActive({
      indicatorId: indicator.id,
      active: !indicator.active,
      reason: reason.trim(),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(indicator.active ? t('indicatorDeactivated') : t('indicatorReactivated'));
    refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>
            {t('indicatorsHeading', {
              total: totals.indicators,
              active: totals.active,
              withData: totals.withData,
            })}
          </CardTitle>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchIndicators')}
            className="max-w-[18rem]"
            aria-label={t('searchIndicatorsLabel')}
          />
        </CardHeader>
      </Card>

      {editing ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {t('editCode', { code: editing.code })}
              <Badge variant="outline">
                {t('versionLabel', { version: editing.currentVersion })}
              </Badge>
              {editing.valueCount > 0 ? (
                <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning-foreground">
                  {t('valuesCollected', { count: editing.valueCount })}
                </Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 mb-4 rounded-md p-3">
              <p className="text-muted-foreground text-xs">{t('verbatimSource')}</p>
              <p className="mt-1 text-sm leading-relaxed">{editing.sourceText}</p>
            </div>

            <form action={onSave} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="definition">{t('officialDefinition')}</Label>
                <Textarea
                  id="definition"
                  name="definition"
                  rows={2}
                  defaultValue={editing.definition ?? ''}
                  placeholder={t('definitionPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">{t('unit')}</Label>
                <Input id="unit" name="unit" defaultValue={editing.unit} required />
                <p className="text-muted-foreground text-xs">
                  {t('currently', {
                    value: tProvenance(editing.unitProvenance as 'PLATFORM_ASSIGNED'),
                  })}
                </p>
              </div>

              <SelectField
                id="dataType"
                label={t('dataTypeLabel')}
                options={DATA_TYPES}
                labelFor={(o) => tDataType(o as 'TEXT')}
                defaultValue={editing.dataType}
                hint={t('currently', {
                  value: tProvenance(editing.dataTypeProvenance as 'PLATFORM_ASSIGNED'),
                })}
              />
              <SelectField
                id="calculationMethod"
                label={t('calculationMethodology')}
                options={METHODS}
                labelFor={(o) => tMethod(o as 'RATIO')}
                defaultValue={editing.calculationMethod}
                hint={t('methodHint', {
                  value: tProvenance(editing.calculationProvenance as 'PLATFORM_ASSIGNED'),
                })}
              />
              <SelectField
                id="direction"
                label={t('directionOfImprovement')}
                options={DIRECTIONS}
                labelFor={(o) => tDirection(o as 'NOT_APPLICABLE')}
                defaultValue={editing.direction}
              />

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ambiguityNote">{t('ambiguityNote')}</Label>
                <Textarea
                  id="ambiguityNote"
                  name="ambiguityNote"
                  rows={2}
                  defaultValue={editing.ambiguityNote ?? ''}
                />
              </div>

              <div className="flex flex-wrap gap-6 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="required"
                    defaultChecked={editing.required}
                    className="accent-primary size-4"
                  />
                  {t('requiredForSubmission')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="sourceRequired"
                    defaultChecked={editing.sourceRequired}
                    className="accent-primary size-4"
                  />
                  {t('dataSourceRequired')}
                </label>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="changeReason">
                  {t('reasonForChange')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="changeReason"
                  name="changeReason"
                  required
                  minLength={5}
                  placeholder={t('reasonPlaceholder')}
                />
                <p className="text-muted-foreground text-xs">{t('reasonRecorded')}</p>
              </div>

              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t('createVersion', { version: editing.currentVersion + 1 })}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  {tCommon('cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {filtered.map((sector) => {
        const isOpen = openSectors.has(sector.code) || Boolean(query);
        return (
          <Card key={sector.code} className="overflow-hidden py-0">
            <button
              type="button"
              onClick={() =>
                setOpenSectors((prev) => {
                  const next = new Set(prev);
                  if (next.has(sector.code)) next.delete(sector.code);
                  else next.add(sector.code);
                  return next;
                })
              }
              aria-expanded={isOpen}
              className="hover:bg-muted/50 flex w-full items-center gap-3 px-5 py-4 text-left"
            >
              <ChevronDown className={cn('size-4 shrink-0 transition-transform', isOpen && 'rotate-180')} />
              <Badge variant="outline" className="font-mono text-xs">{sector.code}</Badge>
              <span className="min-w-0 flex-1 truncate font-medium">{sector.name}</span>
              <span className="text-muted-foreground text-xs tnum">
                {t('indicatorCount', { count: sector.indicators.length })}
              </span>
            </button>

            {isOpen ? (
              <CardContent className="border-t px-5 py-4">
                <div className="scroll-x">
                  <table className="w-full min-w-[52rem] text-sm">
                    <thead>
                      <tr className="border-b">
                        <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tTable('code')}</th>
                        <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tTable('indicator')}</th>
                        <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{t('colTypeMethod')}</th>
                        <th scope="col" className="text-muted-foreground py-2 pe-3 text-end text-xs font-medium">{t('colValues')}</th>
                        <th scope="col" className="text-muted-foreground py-2 text-start text-xs font-medium">{t('colActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sector.indicators.map((i) => (
                        <tr key={i.id} className="border-b align-top last:border-0">
                          <td className="py-2.5 pr-3 font-mono text-xs whitespace-nowrap">
                            {i.code}
                            <span className="text-muted-foreground block">v{i.currentVersion}</span>
                          </td>
                          <td className="max-w-md py-2.5 pr-3">
                            <p className="text-xs leading-relaxed">{i.sourceText}</p>
                            {i.relatedCodes.length > 0 ? (
                              <p className="text-muted-foreground mt-1 text-[0.68rem]">
                                {t('related', { codes: i.relatedCodes.join(', ') })}
                              </p>
                            ) : null}
                          </td>
                          <td className="py-2.5 pr-3 text-xs">
                            <span className="block">{tDataType(i.dataType as 'TEXT')}</span>
                            <span
                              className={cn(
                                'text-muted-foreground block',
                                i.calculationMethod === 'UNDEFINED' && 'text-warning-foreground',
                              )}
                            >
                              {tMethod(i.calculationMethod as 'RATIO')}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-right text-xs tnum">{i.valueCount}</td>
                          <td className="py-2.5">
                            <div className="flex flex-wrap gap-1">
                              <Button size="xs" variant="ghost" onClick={() => setEditing(i)}>
                                <Pencil className="size-3" />
                                {t('edit')}
                              </Button>
                              <Button size="xs" variant="ghost" onClick={() => toggleActive(i)}>
                                {i.active ? t('deactivate') : t('reactivate')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

function SelectField({
  id,
  label,
  options,
  labelFor,
  defaultValue,
  hint,
}: {
  id: string;
  label: string;
  options: readonly string[];
  /** Translates an option value; the value itself is what the form submits. */
  labelFor: (option: string) => string;
  defaultValue: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={id}
        defaultValue={defaultValue}
        className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {labelFor(o)}
          </option>
        ))}
      </select>
      {hint ? <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p> : null}
    </div>
  );
}
