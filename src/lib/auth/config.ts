import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe portion of the Auth.js configuration.
 *
 * This module must not import Prisma, bcrypt or anything else with a Node-only
 * dependency, because middleware evaluates it. The Credentials provider — which
 * does need both — is added in ../../auth.ts, which only ever runs in Node.
 */
export const authConfig = {
  session: {
    strategy: 'jwt',
    // Institutional sessions are deliberately short.
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 30 * 60,
  },
  pages: {
    signIn: '/portal/login',
    error: '/portal/login',
  },
  trustHost: true,
  providers: [], // populated in src/auth.ts
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.countryId = user.countryId;
        token.countryIso2 = user.countryIso2;
        token.countryName = user.countryName;
        token.mustChangePassword = user.mustChangePassword;
      }
      // Lets the password-change flow clear the flag without a re-login.
      if (trigger === 'update' && session && typeof session === 'object') {
        const patch = session as { mustChangePassword?: boolean };
        if (typeof patch.mustChangePassword === 'boolean') {
          token.mustChangePassword = patch.mustChangePassword;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.countryId = token.countryId;
        session.user.countryIso2 = token.countryIso2;
        session.user.countryName = token.countryName;
        session.user.mustChangePassword = token.mustChangePassword;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
