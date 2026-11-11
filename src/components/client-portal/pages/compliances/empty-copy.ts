/**
 * Empty-state wording for the client's compliance pages (Filings, Calendar, Obligations,
 * Registrations). A first-time client opens these before the company is incorporated, when
 * there is nothing to list yet, so each card says what will appear and when, in calm words,
 * instead of a bare "None" or a row of zeros.
 *
 * "Compliances started" is the portal's `after` flag (`effectiveAfter` in
 * `src/lib/client-portal/types.ts`): true once the engagement is incorporated
 * (`isIncorporated`), or when the client previews the After view.
 */

export const COMPLIANCES_NOT_STARTED = "Your compliances haven't started yet.";

/**
 * The Filings register's empty message, or null when the register has rows to show.
 *
 * - Before incorporation: compliances have not started, filings begin after incorporation.
 * - After incorporation, the current or a later financial year with no statutory rows at all:
 *   the compliance calendar has not been set up yet, so the same "not started" message.
 * - A past financial year with no rows: plainly nothing was due that year.
 */
export function filingsEmptyMessage(o: {
  after: boolean;
  /** Rows on the register for the chosen financial year and category. */
  rows: number;
  category: 'all' | 'statutory' | 'non-statutory';
  fy: number;
  currentFy: number;
  fyLabel: string;
}): string | null {
  if (!o.after) return `${COMPLIANCES_NOT_STARTED} Your filings will appear here once compliances begin after incorporation.`;
  if (o.rows > 0) return null;
  if (o.category === 'non-statutory') return `No completed tasks in ${o.fyLabel} yet. Work SBC finishes for you will appear here.`;
  if (o.fy >= o.currentFy) return `${COMPLIANCES_NOT_STARTED} Your filings for ${o.fyLabel} will appear here once SBC starts your compliances.`;
  return `No filings were due in ${o.fyLabel}.`;
}

/** Calendar, before incorporation: a heading and one line under it. */
export const CALENDAR_BEFORE = [COMPLIANCES_NOT_STARTED, 'Due dates will appear on this calendar once compliances begin after incorporation.'] as const;

/** "Due in the next 15 days" on Obligations and Registrations. */
export const dueSoonEmpty = (after: boolean) =>
  after ? 'Nothing is due in the next 15 days.' : 'Nothing is due yet. Due dates will appear here after incorporation.';

/** "Waiting on client" on Obligations and Registrations. */
export const waitingEmpty = (after: boolean) =>
  after ? 'Nothing is waiting on you.' : 'Nothing is waiting on you. Anything SBC needs from you will appear here.';

/** Obligations · Progress flow before incorporation, in place of a legend of zeros. */
export const obligationsProgressBefore = (n: number) =>
  n > 0
    ? `${COMPLIANCES_NOT_STARTED} Progress on your ${n} ${n === 1 ? 'obligation' : 'obligations'} will show here once compliances begin.`
    : `${COMPLIANCES_NOT_STARTED} Progress will show here once compliances begin.`;

/** Registrations · Progress flow while none of them has started, in place of a legend of zeros. */
export const registrationsProgressNotStarted = (n: number, after: boolean) =>
  `${n === 1 ? "Your registration hasn't" : `None of your ${n} registrations have`} started yet. Progress will show here once SBC begins ${n === 1 ? 'it' : 'them'}${after ? '' : ' after incorporation'}.`;
