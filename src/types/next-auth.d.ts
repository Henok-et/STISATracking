import type { UserRole } from '@/generated/prisma/enums';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      /** Always null for ADMIN; the assigned Member State for FOCAL_POINT. */
      countryId: string | null;
      countryIso2: string | null;
      countryName: string | null;
      mustChangePassword: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    role: UserRole;
    countryId: string | null;
    countryIso2: string | null;
    countryName: string | null;
    mustChangePassword: boolean;
  }
}

/**
 * `next-auth/jwt` only re-exports (`export * from "@auth/core/jwt"`), so
 * augmenting it would declare a new interface rather than merge into the real
 * one. The declaration that Auth.js actually resolves lives in @auth/core/jwt.
 */
declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    countryId: string | null;
    countryIso2: string | null;
    countryName: string | null;
    mustChangePassword: boolean;
  }
}

export {};
