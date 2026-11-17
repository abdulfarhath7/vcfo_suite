import 'server-only';

/**
 * RECEIVABLES v2 — the switch for everything partner-facing (docs/specs/receivables/V2.md).
 *
 * Receivables became a staff-only tool: client partners and leadership are typed-in names and
 * addresses, not logins. The partner logins, the partner portal pages and routes, share links (and
 * the Links tab) and the publish alert emails stay in the code but are off unless the server sets
 * `RECEIVABLES_EXTERNAL=on`. While off, those routes answer 404 and the manager area hides them.
 * Server-side only: the flag is never sent to the browser bundle; the manager page passes the
 * answer down as a prop.
 */
export function receivablesExternal(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.RECEIVABLES_EXTERNAL ?? '').trim().toLowerCase() === 'on';
}

/** A 404 for a partner-facing route while the flag is off; null when the route may answer. */
export function externalOffResponse(): Response | null {
  return receivablesExternal() ? null : Response.json({ error: 'not_found' }, { status: 404 });
}
