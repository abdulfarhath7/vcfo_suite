import NextAuth from 'next-auth';
import { authConfigBase } from '@/auth/config.base';

/**
 * The Edge-runtime `auth()` wrapper — for middleware ONLY.
 *
 * It can read and verify the session JWT but cannot sign anyone in, because it
 * has no providers. Server components, route handlers and server actions must
 * import from '@/auth/config' instead, which has the Credentials provider and
 * database access.
 */
export const { auth } = NextAuth(authConfigBase);
