import 'server-only';

import { listMySheets, ReceivablesError, type SheetSummary } from '@/db/repositories/receivables';
import { ActionRefused, recordDraft, refusing } from '../shared';
import type { ActionContext, ActionResult } from '../types';

/**
 * A receivables sheet is the firm's own record of what one organisation owes, kept by one manager.
 * It sits on no project, so these actions take no client from the run's lock: the repository lets in
 * the sheet's own manager and the firm-wide admins, and reads as not found for anyone else.
 */

const REFUSALS: Record<string, string> = {
  not_found: 'That is not on a receivables sheet you manage.',
  not_open: 'This invoice is not open.',
  not_received: 'This invoice is not marked received.',
  not_published: 'Publish the sheet first, so the summary has a version to send.',
  already_sent: 'This reminder has already gone out.',
  already_decided: 'This bank credit has already been decided.',
  already_disputed: 'This invoice is already disputed.',
  not_disputed: 'This invoice is not disputed.',
  invoice: 'One of those invoices is not open on this sheet.',
  credit_note_too_large: 'A credit note must be less than the open balance.',
  amount: 'The amount does not read correctly.',
  tds: 'The TDS amount does not read correctly.',
  client: 'This needs the client\'s name.',
  invoice_date: 'A foreign-currency invoice needs its invoice date, foreign amount and rate.',
  fc_amount: 'A foreign-currency invoice needs its foreign amount.',
  fx_rate: 'A foreign-currency invoice needs its rate.',
  currency: 'That currency is not supported.',
  outlook_not_connected: 'Connect your Outlook first, because the summary goes from your own mailbox.',
  outlook_reconnect: 'Reconnect your Outlook first, because the summary goes from your own mailbox.',
};

/** The repository refuses with short codes; a person reads a sentence. */
export async function said<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ReceivablesError) throw new ActionRefused(REFUSALS[error.code] ?? 'That could not be done on this sheet.');
    throw error;
  }
}
export const run = (work: () => Promise<ActionResult>) => refusing(() => said(work));

/** The one sheet meant: the one named, or the person's only one. The model never needs to guess. */
export async function pickSheet(actx: ActionContext, sheetId: string | undefined): Promise<SheetSummary> {
  const sheets = await listMySheets(actx.auth);
  const named = sheetId ? sheets.find((sheet) => sheet.id === sheetId) : sheets.length === 1 ? sheets[0] : undefined;
  if (named) return named;
  if (sheets.length === 0 || sheetId) throw new ActionRefused(REFUSALS.not_found!);
  throw new ActionRefused(`Say which sheet: ${sheets.map((sheet) => sheet.name).join(' or ')}.`);
}

/** A card with no project on it, so its approval is logged in the sheet's own change log. */
export function sheetCard(actx: ActionContext, draft: Parameters<typeof recordDraft>[1]) {
  return { ...recordDraft({ ...actx, engagementId: 'firm' }, draft), engagementId: null };
}

export const inr = (amount: number | null | undefined) => `₹${(amount ?? 0).toLocaleString('en-IN')}`;
