'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { changePassword } from '@/lib/actions/account';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ChangePasswordForm() {
  const router = useRouter();
  const t = useTranslations('account');
  const { update } = useSession();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(formData: FormData) {
    setPending(true);
    setErrors({});
    try {
      const result = await changePassword({
        currentPassword: String(formData.get('currentPassword') ?? ''),
        newPassword: String(formData.get('newPassword') ?? ''),
        confirmPassword: String(formData.get('confirmPassword') ?? ''),
      });

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }

      // Clear the "must change password" flag in the live session without a
      // sign-out/sign-in round trip.
      await update({ mustChangePassword: false });
      toast.success(t('passwordChanged'));
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="max-w-sm space-y-4">
      <PasswordField
        id="currentPassword"
        label={t('currentPassword')}
        autoComplete="current-password"
        error={errors.currentPassword?.[0]}
      />
      <PasswordField
        id="newPassword"
        label={t('newPassword')}
        autoComplete="new-password"
        error={errors.newPassword?.[0]}
      />
      <PasswordField
        id="confirmPassword"
        label={t('confirmPassword')}
        autoComplete="new-password"
        error={errors.confirmPassword?.[0]}
      />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {t('changePasswordButton')}
      </Button>
    </form>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  autoComplete: string;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type="password"
        autoComplete={autoComplete}
        required
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
