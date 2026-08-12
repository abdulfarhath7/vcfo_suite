import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles } from '@/db/schema';
import { authConfigBase } from '@/auth/config.base';

/**
 * Auth.js (NextAuth v5) — email/password now, SSO later.
 *
 * Replaces Supabase Auth. The Credentials provider checks a bcrypt hash in
 * the `profiles` table. Role + scoping ids (internId, clientId) are baked into
 * the JWT/session so the repository layer can scope every query without an
 * extra DB round-trip.
 *
 * To add SSO later: add an OAuth/SAML provider here (e.g. WorkOS, Okta,
 * Azure AD). The session shape below stays the same, so nothing downstream
 * changes.
 *
 * RUNTIME: this module is Node-only — it imports bcrypt and the Postgres pool.
 * Middleware must NOT import it (that is what broke the Edge bundle with
 * "Native module not found: node:util/types"); it imports '@/auth/edge'
 * instead. Session/JWT callbacks live in '@/auth/config.base' so both runtimes
 * share exactly one copy.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfigBase,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? '').trim().toLowerCase();
        const password = String(creds?.password ?? '');
        if (!email || !password) return null;

        const [row] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.email, email))
          .limit(1);

        if (!row?.passwordHash) return null;
        const ok = await bcrypt.compare(password, row.passwordHash);
        if (!ok) return null;
        if (row.status !== 'active') return null;
        if (row.role === 'intern' && !row.internId?.trim()) {
          // Interns without a scoping key see an empty portfolio — refuse login.
          return null;
        }

        return {
          id: row.id,
          email: row.email,
          name: row.name ?? undefined,
          role: row.role,
          internId: row.internId ?? undefined,
          clientId: row.clientId ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfigBase.callbacks,
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          role?: string;
          internId?: string;
          clientId?: string;
        };
        token.role = u.role;
        token.internId = u.internId;
        token.clientId = u.clientId;
        return token;
      }

      // Keep JWT claims aligned with profiles (Node runtime only).
      // If the profile was deleted/reseeded, clear the token so middleware + APIs
      // both treat the user as signed out (avoids /app shell with 401 APIs).
      if (token.sub) {
        const [row] = await db
          .select({
            role: profiles.role,
            internId: profiles.internId,
            clientId: profiles.clientId,
            status: profiles.status,
            name: profiles.name,
            email: profiles.email,
          })
          .from(profiles)
          .where(eq(profiles.id, token.sub))
          .limit(1);
        if (!row || row.status !== 'active') {
          return {};
        }
        if (row.role === 'intern' && !row.internId?.trim()) {
          return {};
        }
        token.role = row.role;
        token.internId = row.internId ?? undefined;
        token.clientId = row.clientId ?? undefined;
        token.name = row.name ?? undefined;
        token.email = row.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token?.sub || !token.role) {
        // Force clients to treat this as signed-out.
        return { ...session, user: undefined as unknown as typeof session.user };
      }
      if (session.user) {
        session.user.id = token.sub as string;
        if (typeof token.name === 'string') session.user.name = token.name;
        if (typeof token.email === 'string') session.user.email = token.email;
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
});
