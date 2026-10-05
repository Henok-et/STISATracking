'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, UserPlus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { createUser, updateUser, resetUserPassword } from '@/lib/actions/admin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { UserRole } from '@/generated/prisma/enums';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  countryId: string | null;
  countryName: string | null;
  organisation: string | null;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
}

interface CountryOption {
  id: string;
  shortName: string;
  iso2: string;
}

export function UserManager({
  users,
  countries,
}: {
  users: UserRow[];
  countries: CountryOption[];
}) {
  const router = useRouter();
  const t = useTranslations('adminPages');
  const tAccount = useTranslations('account');
  const tAdmin = useTranslations('admin');
  const tCommon = useTranslations('common');
  const tTable = useTranslations('table');
  const locale = useLocale();
  const [, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [role, setRole] = useState<UserRole>('FOCAL_POINT');
  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [query, setQuery] = useState('');

  const refresh = () => startTransition(() => router.refresh());

  async function onCreate(formData: FormData) {
    setPending(true);
    setErrors({});
    try {
      const chosenRole = String(formData.get('role')) as UserRole;
      const result = await createUser({
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? ''),
        role: chosenRole,
        countryId: chosenRole === 'FOCAL_POINT' ? String(formData.get('countryId') ?? '') : null,
        organisation: String(formData.get('organisation') ?? '') || null,
        title: String(formData.get('title') ?? '') || null,
        password: String(formData.get('password') ?? ''),
      });

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(t('accountCreated'), { description: t('accountCreatedBody') });
      setShowCreate(false);
      refresh();
    } finally {
      setPending(false);
    }
  }

  async function toggleActive(user: UserRow) {
    const result = await updateUser({ userId: user.id, active: !user.active });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(user.active ? t('accountDeactivated') : t('accountReactivated'));
    refresh();
  }

  async function reassign(user: UserRow, countryId: string) {
    const result = await updateUser({ userId: user.id, countryId });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t('assignmentUpdated'));
    refresh();
  }

  async function onReset(formData: FormData) {
    if (!resetFor) return;
    setPending(true);
    try {
      const result = await resetUserPassword({
        userId: resetFor.id,
        password: String(formData.get('password') ?? ''),
      });
      if (!result.ok) {
        toast.error(result.error, {
          description: result.fieldErrors?.password?.[0],
        });
        return;
      }
      toast.success(t('passwordReset'), { description: t('passwordResetBody') });
      setResetFor(null);
      refresh();
    } finally {
      setPending(false);
    }
  }

  const filtered = query
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(query.toLowerCase()) ||
          u.email.toLowerCase().includes(query.toLowerCase()) ||
          (u.countryName ?? '').toLowerCase().includes(query.toLowerCase()),
      )
    : users;

  return (
    <div className="space-y-6">
      {showCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('newAccount')}</CardTitle>
            <CardDescription>{t('newAccountDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={onCreate} className="grid gap-4 sm:grid-cols-2">
              <FormField label={t('fullName')} name="name" required error={errors.name?.[0]} />
              <FormField
                label={t('emailAddress')}
                name="email"
                type="email"
                required
                error={errors.email?.[0]}
              />

              <div className="space-y-2">
                <Label htmlFor="role">{tAccount('role')}</Label>
                <select
                  id="role"
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
                >
                  <option value="FOCAL_POINT">{t('roleFocalPointOption')}</option>
                  <option value="ADMIN">{t('roleAdminOption')}</option>
                </select>
              </div>

              {role === 'FOCAL_POINT' ? (
                <div className="space-y-2">
                  <Label htmlFor="countryId">
                    {tTable('memberState')} <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="countryId"
                    name="countryId"
                    required
                    className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
                  >
                    <option value="">{t('selectMemberState')}</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.shortName}
                      </option>
                    ))}
                  </select>
                  {errors.countryId?.[0] ? (
                    <p className="text-destructive text-xs">{errors.countryId[0]}</p>
                  ) : null}
                </div>
              ) : (
                <div className="text-muted-foreground self-end text-xs">
                  {t('adminNoState')}
                </div>
              )}

              <FormField label={t('jobTitle')} name="title" />
              <FormField label={tAccount('organisation')} name="organisation" />

              <FormField
                label={t('temporaryPassword')}
                name="password"
                type="password"
                required
                hint={t('passwordHint')}
                error={errors.password?.[0]}
                className="sm:col-span-2"
              />

              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t('createAccount')}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                  {tCommon('cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{t('accountCount', { count: users.length })}</CardTitle>
            <CardDescription>
              {t('accountBreakdown', {
                focal: users.filter((u) => u.role === 'FOCAL_POINT' && u.active).length,
                admins: users.filter((u) => u.role === 'ADMIN' && u.active).length,
              })}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`${tCommon('search')}…`}
              className="max-w-[14rem]"
              aria-label={t('searchAccounts')}
            />
            {!showCreate ? (
              <Button onClick={() => setShowCreate(true)}>
                <UserPlus className="size-4" />
                {t('newAccount')}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {resetFor ? (
            <form action={onReset} className="mb-6 space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">
                {t('resetPasswordFor', { name: resetFor.name, email: resetFor.email })}
              </p>
              <Input
                name="password"
                type="password"
                required
                placeholder={t('newTemporaryPassword')}
                className="max-w-sm"
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t('resetPasswordButton')}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setResetFor(null)}>
                  {tCommon('cancel')}
                </Button>
              </div>
            </form>
          ) : null}

          <div className="scroll-x">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b">
                  <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tAccount('name')}</th>
                  <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tAccount('role')}</th>
                  <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tTable('memberState')}</th>
                  <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tAccount('lastSignIn')}</th>
                  <th scope="col" className="text-muted-foreground py-2 text-start text-xs font-medium">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/40 border-b last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="font-medium">{u.name}</span>
                      <span className="text-muted-foreground block text-xs">{u.email}</span>
                      {u.mustChangePassword ? (
                        <Badge variant="outline" className="mt-1 text-[0.62rem]">
                          {t('passwordChangePending')}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'} className="text-[0.68rem]">
                        {u.role === 'ADMIN' ? t('administratorRole') : t('focalPointRole')}
                      </Badge>
                      {!u.active ? (
                        <Badge variant="outline" className="ms-1 text-[0.62rem]">
                          {tAdmin('inactive')}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3">
                      {u.role === 'FOCAL_POINT' ? (
                        <select
                          value={u.countryId ?? ''}
                          onChange={(e) => reassign(u, e.target.value)}
                          aria-label={t('memberStateFor', { name: u.name })}
                          className="border-input bg-background h-7 rounded-md border px-2 text-xs"
                        >
                          {countries.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.shortName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted-foreground text-xs">{tAdmin('continental')}</span>
                      )}
                    </td>
                    <td className="text-muted-foreground py-2.5 pr-3 text-xs">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString(locale, { timeZone: 'UTC' })
                        : t('never')}
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-1">
                        <Button size="xs" variant="ghost" onClick={() => setResetFor(u)}>
                          <KeyRound className="size-3" />
                          {t('reset')}
                        </Button>
                        <Button
                          size="xs"
                          variant={u.active ? 'ghost' : 'secondary'}
                          onClick={() => toggleActive(u)}
                        >
                          {u.active ? t('deactivate') : t('reactivate')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FormField({
  label,
  name,
  type = 'text',
  required,
  hint,
  error,
  className,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive ms-0.5">*</span> : null}
      </Label>
      <Input id={name} name={name} type={type} required={required} aria-invalid={Boolean(error)} />
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
