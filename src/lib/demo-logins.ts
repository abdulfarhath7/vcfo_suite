/**
 * DEMO LOGINS — shared demo accounts on the real application (docs/context/notes/demo-data.md,
 * "Demo logins"). People outside SBC use them, so they live next to real clients in the
 * production database and must never see or change anything real.
 *
 * How the isolation works:
 *   - The seed (`npm run db:seed-demo-logins`) flags its rows `is_demo` (profiles, engagements).
 *   - Only the lead (`intern`) and `client` roles are admitted for a demo profile. Their normal
 *     role scope already confines them to the engagements they are assigned to, and every demo
 *     engagement is assigned only to demo people. A demo admin, manager or developer would be
 *     firm-wide, so the guard and the sign-in refuse one even if the row is switched on.
 *   - A demo AuthContext carries `demo: true`, and the few firm-wide or account writes a lead or
 *     client can reach call `assertNotDemo`, which throws `DemoBlockedError`.
 *   - Outbound email to a demo mailbox, or sent while a demo person is signed in, is written to
 *     the log only (`src/lib/email/send-email.ts`, `src/lib/notify/*`).
 *
 * Pure: no database or server imports, so client components and tests can use it.
 */

/** Every demo mailbox is on this domain. The mailboxes do not exist, so nothing is ever sent there. */
export const DEMO_EMAIL_DOMAIN = 'vcfosuite.com';

/** The message every refused action shows. */
export const DEMO_BLOCKED_MESSAGE = 'Not available on demo logins';

/** The roles a demo profile may sign in with. Both are scoped to assigned engagements only. */
export const DEMO_ALLOWED_ROLES = ['intern', 'client'] as const;

/** True when a demo profile with this role may be given a session. Real profiles are unaffected. */
export function demoRoleAllowed(isDemo: boolean | null | undefined, role: string | null | undefined): boolean {
  if (!isDemo) return true;
  return (DEMO_ALLOWED_ROLES as readonly string[]).includes(String(role ?? ''));
}

/** True for an address on the demo domain (case-insensitive, display names allowed). */
export function isDemoEmail(address: string | null | undefined): boolean {
  const a = String(address ?? '').trim().toLowerCase();
  const m = /<([^>]+)>\s*$/.exec(a);
  const bare = (m ? m[1] : a).trim();
  return bare.endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

/** Thrown by `assertNotDemo`; routes answer it with 403 and `DEMO_BLOCKED_MESSAGE`. */
export class DemoBlockedError extends Error {
  readonly status = 403 as const;
  readonly code = 'demo_blocked' as const;
  constructor(public readonly action: string = 'this') {
    super(DEMO_BLOCKED_MESSAGE);
    this.name = 'DemoBlockedError';
  }
}

export function isDemoBlockedError(err: unknown): err is DemoBlockedError {
  return err instanceof DemoBlockedError || (err instanceof Error && err.message === DEMO_BLOCKED_MESSAGE);
}

/** Refuse an action for a demo context. `action` is only for the log. */
export function assertNotDemo(ctx: { demo?: boolean } | null | undefined, action?: string): void {
  if (ctx?.demo) throw new DemoBlockedError(action);
}

/** The JSON body and status a route returns for a refused demo action. */
export function demoBlockedBody(): { ok: false; error: string; code: 'demo_blocked' } {
  return { ok: false, error: DEMO_BLOCKED_MESSAGE, code: 'demo_blocked' };
}

type GuardLike = { ok: true; ctx: { demo?: boolean } } | { ok: false; status: number; error: string };

/**
 * Refuses a demo login with 403 "Not available on demo logins". Wrap the guard of a route a demo
 * person must not use: `noDemo(await requireAuth())`. Account, user management, integration,
 * export and firm-wide writes use it. It lives here, not in `@/auth/guards`, so route tests that
 * mock the guards module keep working.
 */
export function noDemo<R extends GuardLike>(result: R): R | { ok: false; status: 403; error: string } {
  if (result.ok === true && result.ctx.demo) return { ok: false, status: 403, error: DEMO_BLOCKED_MESSAGE };
  return result;
}
