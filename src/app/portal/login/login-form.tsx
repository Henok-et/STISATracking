'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { AlertCircle, Loader2 } from 'lucide-react';

import { login } from '@/lib/actions/account';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

const KNOWN_ERRORS = [
  'InvalidCredentials',
  'AccountDisabled',
  'NoCountryAssigned',
  'TooManyAttempts',
];

function SubmitButton() {
  const t = useTranslations('auth');
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {pending ? t('signingIn') : t('signInTitle')}
    </Button>
  );
}

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const t = useTranslations('auth');
  const [state, formAction] = useActionState(login, null);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state && !state.ok ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {/*
              The Server Action returns a stable code alongside its English
              fallback. Translating from the code here keeps the message in the
              reader's language without the server needing to know it.
            */}
            {state.code && KNOWN_ERRORS.includes(state.code)
              ? t(`errors.${state.code}` as 'errors.InvalidCredentials')
              : state.error}
          </AlertDescription>
        </Alert>
      ) : null}

      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ''} />

      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="focal.point@ministry.gov"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <SubmitButton />
    </form>
  );
}
