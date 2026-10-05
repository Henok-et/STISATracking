'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

/**
 * Client-side session context.
 *
 * Mounted only inside the authenticated areas — the public pages read the
 * session on the server and have no need to ship this to the browser.
 */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
