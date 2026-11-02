/**
 * LOCAL DIRECT SIGN-IN (development only).
 *
 * While the portals are being reviewed on localhost, the owner opens them
 * without the password screen: an unsigned visit to `/` or `/app/*` goes to
 * `/dev-direct`, which signs in as one of the accounts listed in `.env.local`:
 *
 *   DEV_DIRECT_LOGIN_EMAIL=prithish@sbcllp.in,pranay.k@sbcllp.in,bhavana@sbcllp.in
 *
 * One email: that account opens straight away. Several: /dev-direct shows a
 * small "Open as" page, and `/dev-direct?as=<email>` switches account.
 *
 * Safety:
 *  - Off unless that variable is set, and always off when NODE_ENV is
 *    'production' (AWS App Runner runs `next start`, which is production), so
 *    even a copied variable cannot open the live site.
 *  - It can only sign in as an email on that list — an email from the request
 *    is accepted only when it is on the list — and the account must be active,
 *    exactly as for a password login.
 *  - `/login` keeps working; remove the line from `.env.local` to bring the
 *    password screen back for everyone.
 *
 * Edge-safe (no db, no Node built-ins): proxy.ts imports it.
 */
export function devDirectEmails(env: Record<string, string | undefined> = process.env): string[] {
  if (env.NODE_ENV === 'production') return [];
  const raw = env.DEV_DIRECT_LOGIN_EMAIL ?? '';
  const list = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'));
  return [...new Set(list)];
}

/** The first listed account (the default), or null when direct sign-in is off. */
export function devDirectEmail(env: Record<string, string | undefined> = process.env): string | null {
  return devDirectEmails(env)[0] ?? null;
}

/** The email to sign in as: `requested` only if it is on the list; with no request, the only account (if one). */
export function devDirectPick(requested: string | null | undefined, env: Record<string, string | undefined> = process.env): string | null {
  const list = devDirectEmails(env);
  if (!list.length) return null;
  const want = requested?.trim().toLowerCase();
  if (want) return list.includes(want) ? want : null;
  return list.length === 1 ? list[0]! : null;
}

/** Where to land after a direct sign-in: an in-app path only (never another site). */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith('/app/') && next !== '/app') return null;
  if (next.startsWith('//') || next.includes('\\')) return null;
  return next;
}
