/**
 * DEMO LOGINS — shared demo accounts on the real application (docs/context/notes/demo-data.md,
 * "Demo logins"). People outside SBC use them, so they must never see or change anything real.
 *
 * How the isolation works (PLAN H2):
 *   - The demo people and companies live in their own database (`DEMO_DB_NAME`, default
 *     `vcfo_demo`) on the same Postgres server. An email on `DEMO_EMAIL_DOMAIN` signs in only
 *     against that database; its session token carries `demo: true`, and every query of a demo
 *     request goes to the demo database (`src/db/demo-scope.ts`, `src/db/client.ts`). So every
 *     role (admin, manager, lead, client) can have a demo login: firm-wide for a demo admin means
 *     the demo firm.
 *   - The seed (`npm run db:seed-demo-logins`) still flags its rows `is_demo`, and a demo
 *     AuthContext carries `demo: true`. Account, user-management, integration and export actions
 *     call `assertNotDemo` / `noDemo`, which refuse with `DemoBlockedError`, so the shared logins
 *     stay stable and nothing leaves the demo world.
 *   - Outbound email and WhatsApp inside a demo scope, or to a demo mailbox, are written to the
 *     log only (`src/lib/email/send-email.ts`, `src/lib/notify/*`).
 *
 * Pure: no database or server imports, so client components and tests can use it.
 */

/** Every demo mailbox is on this domain. The mailboxes do not exist, so nothing is ever sent there. */
export const DEMO_EMAIL_DOMAIN = 'vcfosuite.com';

/** The message every refused action shows. */
export const DEMO_BLOCKED_MESSAGE = 'Not available on demo logins';

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
