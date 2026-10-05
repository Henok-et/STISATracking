import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth/config';

/**
 * Coarse route protection only.
 *
 * Middleware runs before the request reaches a page and can cheaply bounce
 * anonymous traffic away from the portal and admin areas. It is NOT the
 * enforcement point for authorization — role and country checks are re-run
 * server-side in every page and Server Action (src/lib/auth/guards.ts), because
 * a session cookie alone must never be sufficient to reach another country's
 * data.
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const path = nextUrl.pathname;

  const isLogin = path === '/portal/login';
  const isProtected = path.startsWith('/portal') || path.startsWith('/admin');

  if (isLogin && session) {
    const home = session.user?.role === 'ADMIN' ? '/admin/overview' : '/portal';
    return NextResponse.redirect(new URL(home, nextUrl));
  }

  if (isProtected && !isLogin && !session) {
    const login = new URL('/portal/login', nextUrl);
    login.searchParams.set('callbackUrl', path);
    return NextResponse.redirect(login);
  }

  // Administrators have no data-entry workspace of their own.
  if (path.startsWith('/admin') && session && session.user?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/portal', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/portal/:path*', '/admin/:path*'],
};
