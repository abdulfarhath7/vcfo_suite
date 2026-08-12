import type { NextAuthConfig } from 'next-auth';

/**
 * EDGE-SAFE Auth.js config: session strategy, pages, and the JWT/session
 * callbacks. Deliberately contains NO providers, because our only provider
 * needs bcrypt and the Postgres pool — both Node-only.
 *
 * >>> Do not import `@/db/*`, `bcryptjs`, or anything Node-only here. <<<
 * This module is bundled into the Edge middleware. Pulling a Node built-in in
 * (even transitively) fails at runtime with:
 *   "Failed to load external module node:util/types: Native module not found"
 *
 * Why this split works: with `strategy: 'jwt'` the middleware only has to
 * VERIFY a signed token using AUTH_SECRET — it never reads the database. The
 * callbacks below must live here rather than in the Node config, so the role
 * and scoping ids are present on `req.auth` when middleware does its role
 * routing.
 */
export const authConfigBase = {
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  providers: [], // supplied by src/auth/config.ts (Node runtime only)
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.internId = (user as { internId?: string }).internId;
        token.clientId = (user as { clientId?: string }).clientId;
      }
      return token;
    },
    async session({ session, token }) {
      // Edge + Node: no role means signed-out (stale JWT after reseed/delete).
      if (!token?.sub || !token.role) {
        return { ...session, user: undefined as unknown as typeof session.user };
      }
      if (session.user) {
        session.user.id = token.sub as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { internId?: string }).internId = token.internId as
          | string
          | undefined;
        (session.user as { clientId?: string }).clientId = token.clientId as
          | string
          | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
