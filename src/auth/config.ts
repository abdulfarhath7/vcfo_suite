import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles } from '@/db/schema';
import { authConfigBase } from '@/auth/config.base';
import { systemCheckSignInPassword } from '@/db/repositories/profiles';
import {
  systemCreateUserSession,
  systemIsSessionActive,
  systemRevokeSession,
} from '@/db/repositories/user-sessions';
import { checkTotpCode } from '@/lib/totp/check';

/**
 * Two-step sign-in outcomes (G-25). Each reaches the browser as `code` on the
 * `signIn()` result. They are only thrown after the password was accepted, so
 * they never say whether an email exists.
 */
class TwoStepRequired extends CredentialsSignin {
  code = 'two_step_required';
}
class TwoStepInvalid extends CredentialsSignin {
  code = 'two_step_invalid';
}
class TwoStepLocked extends CredentialsSignin {
  code = 'two_step_locked';
}

/** The first address in X-Forwarded-For (App Runner and the tunnel set it), else X-Real-IP. */
function clientIp(request: Request | undefined): string | null {
  const fwd = request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || request?.headers.get('x-real-ip')?.trim() || null;
}

/**
 * Auth.js (NextAuth v5) — email/password now, SSO later.
 *
 * Replaces Supabase Auth. The Credentials provider checks a bcrypt hash in
 * the `profiles` table. Role + scoping ids (internId, clientId) are baked into
 * the JWT/session so the repository layer can scope every query without an
 * extra DB round-trip.
 *
 * Two-step sign-in (G-25): when `profiles.totp_enabled_at` is set, `authorize`
 * also needs a valid `otp` field (RFC 6238, see `src/lib/totp/`). The sign-in
 * screen learns whether to ask for one from `POST /api/auth/two-step`.
 *
 * Devices (G-25): each sign-in makes a `user_sessions` row and the JWT carries
 * its id as `sid`. A revoked row clears the token here and fails
 * `currentContext` in `guards.ts`; signing out revokes the row.
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
        otp: { label: 'Code', type: 'text' },
      },
      async authorize(creds, request) {
        const row = await systemCheckSignInPassword(String(creds?.email ?? ''), String(creds?.password ?? ''));
        if (!row) return null;

        if (row.twoStepOn) {
          const otp = String(creds?.otp ?? '').trim();
          if (!otp) throw new TwoStepRequired();
          const check = checkTotpCode(row.id, row.totpSecretEnc, otp);
          if (check === 'locked') throw new TwoStepLocked();
          if (check === 'invalid') throw new TwoStepInvalid();
        }

        const sid = await systemCreateUserSession({
          userId: row.id,
          userAgent: request?.headers.get('user-agent'),
          ip: clientIp(request),
        });

        return {
          id: row.id,
          email: row.email,
          name: row.name ?? undefined,
          role: row.role,
          internId: row.internId ?? undefined,
          clientId: row.clientId ?? undefined,
          hasAvatar: Boolean(row.avatarObjectKey),
          avatarVersion: row.updatedAt.getTime(),
          sid: sid ?? undefined,
        };
      },
    }),
  ],
  events: {
    async signOut(message) {
      const token = 'token' in message ? message.token : null;
      if (typeof token?.sid === 'string' && typeof token.sub === 'string') {
        await systemRevokeSession(token.sid, token.sub);
      }
    },
  },
  callbacks: {
    ...authConfigBase.callbacks,
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          role?: string;
          internId?: string;
          clientId?: string;
          hasAvatar?: boolean;
          avatarVersion?: number;
          sid?: string;
        };
        token.role = u.role;
        token.internId = u.internId;
        token.clientId = u.clientId;
        token.hasAvatar = Boolean(u.hasAvatar);
        token.avatarVersion = u.avatarVersion;
        if (u.sid) token.sid = u.sid;
        return token;
      }

      // Keep JWT claims aligned with profiles (Node runtime only).
      // If the profile was deleted/reseeded, clear the token so middleware + APIs
      // both treat the user as signed out (avoids /app shell with 401 APIs).
      if (token.sub) {
        const sid = typeof token.sid === 'string' ? token.sid : null;
        const rowQuery = db
          .select({
            role: profiles.role,
            internId: profiles.internId,
            clientId: profiles.clientId,
            status: profiles.status,
            name: profiles.name,
            email: profiles.email,
            avatarObjectKey: profiles.avatarObjectKey,
            updatedAt: profiles.updatedAt,
          })
          .from(profiles)
          .where(eq(profiles.id, token.sub))
          .limit(1);
        const [[row], sessionActive] = await Promise.all([
          rowQuery,
          sid ? systemIsSessionActive(sid, token.sub) : Promise.resolve(true),
        ]);
        // A device signed out from Profile: clear the token like a deleted profile.
        if (!sessionActive) {
          return {};
        }
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
        token.hasAvatar = Boolean(row.avatarObjectKey);
        token.avatarVersion = row.updatedAt.getTime();
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
        (session.user as { hasAvatar?: boolean }).hasAvatar = Boolean(token.hasAvatar);
        (session.user as { avatarVersion?: number }).avatarVersion =
          typeof token.avatarVersion === 'number' ? token.avatarVersion : undefined;
        // The device id; `currentContext` reads it to check the row is not revoked.
        (session.user as { sid?: string }).sid = typeof token.sid === 'string' ? token.sid : undefined;
      }
      return session;
    },
  },
});
