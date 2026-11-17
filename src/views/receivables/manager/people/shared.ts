import type { ClientDto, EmailKind, EmailSettingsDto } from '@/lib/receivables/v2-wire';
import type { useReceivablesActions } from '@/hooks/use-receivables';
import type { usePeopleActions } from '@/hooks/use-receivables-v2';
import { toastError, toastSuccess } from '@/lib/toast-errors';

/** Shared types, labels and dense table classes of the People tab and its sub-tabs. */

export type Actions = ReturnType<typeof useReceivablesActions>;
export type PeopleActions = ReturnType<typeof usePeopleActions>;
export type SaveSettings = (patch: Partial<EmailSettingsDto>) => void;

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const HOURS = Array.from({ length: 15 }, (_, i) => i + 6);
export const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'am' : 'pm'} IST`;
/** The short hour for the top row: "9 am", "2 pm". */
export const shortHour = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'am' : 'pm'}`;

export const KIND_LABEL: Record<EmailKind, string> = {
  new_invoice: 'New invoice',
  revised: 'Revised',
  rollup: 'Roll-up',
  digest: 'Digest',
  client_statement: 'Statement',
  payment_received: 'Payment received',
};
export const ERROR_LABEL: Record<string, string> = {
  outlook_not_connected: 'Outlook not connected',
  outlook_reconnect: 'Outlook needs reconnecting',
  send_failed: 'Outlook did not send',
  no_sender: 'No sender (the sheet has no manager)',
};

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');
export const stamp = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';

/* Tables: a 40px row, 13px text and an 11.5px uppercase head; roomy enough to read, no wasted space. */
export const TH = 'whitespace-nowrap border-b border-line bg-surface-sunken px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-[.04em] text-ink-muted';
export const TD = 'h-10 border-t border-line-soft px-3 py-1 align-middle text-[13px]';
/** A button the same size as its row's text. The base button sets its height with a custom token, so the override needs `!`. */
export const ROW_BTN = '!h-7 !px-2.5 !text-[12.5px] [&_svg]:!size-3.5';
/** A small native select or number input inside a row. */
export const ROW_INPUT = 'h-7 rounded-md border border-line bg-surface-raised px-2 text-[13px]';

/** Emails a client its open invoices from the user's Outlook ("Send statement"). */
export function sendStatement(act: PeopleActions, c: ClientDto) {
  act.sendStatement.mutate(c.id, {
    onSuccess: () => toastSuccess(`Statement to ${c.billingEmail}`, 'Sending from your Outlook. The Log tab shows when it has gone.'),
    onError: (e) => toastError('Not sent', errorText(e)),
  });
}

/** The tooltip and the disabled state of "Send statement" for one client. */
export function statementBlock(c: ClientDto): string | null {
  if (!c.billingEmail) return 'Add a billing email first';
  if (!c.openCount) return 'No open invoices';
  return null;
}
