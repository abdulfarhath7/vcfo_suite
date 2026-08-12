// MUST be '@/auth/edge', not '@/auth/config'. This file runs in the Edge
// runtime; the Node config imports bcrypt and the pg pool, which fails here
// with "Failed to load external module node:util/types".
import { auth } from '@/auth/edge';
import { NextResponse } from 'next/server';

/**
 * Route protection + role-home redirects.
 *
 *   - unauthenticated on /app/* -> /login?next=...
 *   - authenticated on / or /login -> role home
 *   - cross-role guard: URL segment must match the session role
 *     (super_admin may enter every segment for bird's-eye review)
 */
const roleHome: Record<string, string> = {
  super_admin: '/app/super/dashboard',
  admin: '/app/admin/dashboard',
  manager: '/app/manager/dashboard',
  intern: '/app/intern/today',
  client: '/app/client/inbox',
};

const roleSegment: Record<string, string> = {
  super_admin: 'super',
  admin: 'admin',
  manager: 'manager',
  intern: 'intern',
  client: 'client',
};

const ALL_SEGMENTS = new Set(['super', 'admin', 'manager', 'intern', 'client']);

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const path = nextUrl.pathname;

  const isApp = path.startsWith('/app');
  const isAuthPage = path === '/login' || path === '/';

  if (isApp && (!session?.user || !role)) {
    const url = new URL('/login', nextUrl);
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  if (session?.user && isAuthPage && role) {
    return NextResponse.redirect(new URL(roleHome[role] ?? '/login', nextUrl));
  }

  if (isApp && role) {
    const seg = path.split('/')[2]; // admin | manager | intern | client | super
    if (seg && ALL_SEGMENTS.has(seg)) {
      if (role === 'super_admin') {
        // Bird's-eye: may enter any workspace segment.
        return NextResponse.next();
      }
      const expected = roleSegment[role];
      if (expected && seg !== expected) {
        return NextResponse.redirect(new URL(roleHome[role], nextUrl));
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/', '/login', '/app/:path*'],
};
