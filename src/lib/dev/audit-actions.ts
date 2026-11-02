/**
 * Which audit events the developer console shows: system and access actions only (sign-in,
 * sessions, two-step, accounts and roles, firm settings, jobs, lockouts), plus any event whose
 * result is "failed" or "denied". Work on client records (steps, documents, mail) stays out.
 */

/** Action prefixes. A prefix ending in "." matches the whole family; others match exactly or as a prefix. */
export const DEV_AUDIT_PREFIXES = [
  'system.',
  'auth.',
  'session.',
  'sessions.',
  'security.',
  'two_step.',
  'totp.',
  'account.',
  'admin.create',
  'manager.create',
  'intern.create',
  'developer.',
  'dev.',
  'firm_settings.',
  'credentials.otp_locked',
  'identifiers.reveal_locked',
] as const;

export const DEV_AUDIT_RESULTS = ['failed', 'denied'] as const;

/** The same rule as the SQL filter in `dev-audit.ts`, for tests and for the view. */
export function isDevAuditEvent(action: string, result: string): boolean {
  if ((DEV_AUDIT_RESULTS as readonly string[]).includes(result)) return true;
  return DEV_AUDIT_PREFIXES.some((p) => action.startsWith(p));
}

/** "two_step.enable" becomes "Two step enable" for the Action column. */
export function actionLabel(action: string): string {
  const t = action.replace(/[._]+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : action;
}
