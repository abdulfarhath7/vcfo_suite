'use client';

/**
 * Receivables manager data (docs/specs/receivables/PLAN.md): TanStack Query over /api/receivables.
 * Every route scopes by the caller's AuthContext in its repository. Each write refetches the
 * sheet, so the unpublished count and totals stay right.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InvoiceInput, InvoicePatch, ReceiptInput } from '@/lib/receivables/model';
import type { InvoiceHistoryDto, PendingChangesDto } from '@/lib/receivables/history-wire';
import type { InvoiceNoteDto, ManagerSheetDto, OutlookStatusDto, PartnerDto, SummaryDto, SummaryEmailDto, VersionDto, VersionMetaDto } from '@/lib/receivables/wire';

const ERROR_TEXT: Record<string, string> = {
  client: 'Enter the client name.',
  invoice_no: 'The invoice number is too long.',
  invoice_month: 'Pick the invoice month.',
  due_date: 'Enter a valid due date.',
  amount: 'Enter an amount above zero.',
  partner: 'Pick a client partner from the list.',
  paid_on: 'Enter the date the money arrived.',
  not_open: 'This invoice is already received.',
  not_received: 'This invoice is not marked received.',
  until: 'Enter a valid date.',
  name: 'Enter the name.',
  email: 'Enter a valid email address.',
  not_found: 'This sheet is not assigned to you.',
  not_published: 'Click Update once first; the email is built from the published version.',
  outlook_not_connected: 'Connect your Outlook first.',
  outlook_reconnect: 'Outlook needs to be connected again.',
  send_failed: 'Outlook did not send the email. Try again.',
  bad_email: 'One of the addresses is not a valid email.',
  partner_to: 'A client partner\'s email must go to that partner alone.',
  partner_elsewhere: 'A client partner can only get their own email. Remove them from Cc and from the other emails.',
  partner_unknown: 'That client partner is not on this sheet.',
  nothing_received: 'These invoices are not marked received.',
  to_required: 'Add at least one recipient in To.',
  subject_required: 'Write a subject.',
  already_sent: 'This reminder has already gone.',
  file_required: 'Choose a statement file.',
  too_large: 'The file is over 5 MB.',
  not_a_statement: 'This is not an ISO 20022 bank statement (camt.053 or camt.054 XML).',
  already_decided: 'This credit is already handled.',
  invoice: 'Pick an open invoice of this sheet.',
  send_hour: 'Pick a send hour between 6 and 20.',
  Forbidden: 'Your role cannot open receivables.',
  already_invited: 'This partner already has a login.',
  partner_inactive: 'Turn the partner on (Active) before inviting them.',
  email_in_use: 'This email belongs to a staff or client account. Use another email for the partner.',
  login_disabled: 'This login is disabled. Enable it first.',
  not_invited: 'Invite the partner first.',
  already_accepted: 'The partner has set a password already. Use Reset password.',
  not_accepted: 'The partner has not set a password yet. Use Resend invite.',
  not_disabled: 'This login is not disabled.',
  note: 'Write a note of up to 2000 characters.',
  currency: 'Pick INR or one of the listed foreign currencies.',
  fc_amount: 'Enter the foreign amount above zero.',
  fx_rate: 'Enter the booked rate (INR per unit) above zero.',
  invoice_date: 'Enter the invoice date of the foreign invoice.',
  forward: 'Pick an open forward contract of this currency with an amount left.',
  tds: 'Enter the TDS in rupees, zero or more.',
  /* Receivables v2: the Tally import, approval, amount changes and the People tab. */
  not_xlsx: 'Export from Tally as Excel (.xlsx).',
  not_sales_register: 'This file is not a Tally Sales Register (no "Voucher No." column was found).',
  no_rows: 'The file has no Sales vouchers to import.',
  rows: 'Tick at least one row.',
  paid_locked: 'This invoice is received or part-paid. Reopen the payment first.',
  no_partner: 'Pick a client partner for this client first.',
  already_exists: 'An invoice with this voucher number is already on the sheet.',
  reason: 'Write the reason for the change (up to 300 characters).',
  same_amount: 'The new amount is the same as the current one.',
  credit_days: 'Enter credit days between 0 and 365.',
  client_exists: 'A client with this name is already on the sheet.',
  gstin: 'The GSTIN is too long.',
  weekday: 'Pick a weekday.',
  rollup_days: 'Pick at least one day for the roll-up.',
  not_failed: 'Only a failed email can be retried.',
  no_billing_email: 'Add the client\'s billing email first.',
  nothing_open: 'This client has no open invoices.',
  doubletick_not_configured: 'DoubleTick is not set up on the server yet.',
  no_phone: 'Add your WhatsApp number in Account settings first.',
  whatsapp_failed: 'DoubleTick did not send the message.',
};

class ReceivablesApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** Fetch JSON from a receivables route; an error code becomes the plain message in ERROR_TEXT. */
export async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; detail?: string };
  if (!res.ok) {
    const text = (body.error && ERROR_TEXT[body.error]) || body.error || 'Something went wrong. Try again.';
    // A provider's own reason (DoubleTick) rides in `detail`, so the person sees why.
    throw new ReceivablesApiError(body.detail ? `${text} ${body.detail}` : text, res.status, body.error);
  }
  return body;
}

export const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const sheetKey = (sheetId: string) => ['receivables', 'sheet', sheetId] as const;
const versionsKey = (sheetId: string) => ['receivables', 'versions', sheetId] as const;

export function useManagerSheet(sheetId: string) {
  return useQuery({
    queryKey: sheetKey(sheetId),
    queryFn: () => call<ManagerSheetDto>(`/api/receivables/sheets/${sheetId}`),
  });
}

export function useVersions(sheetId: string, enabled = true) {
  return useQuery({
    queryKey: versionsKey(sheetId),
    queryFn: async () => (await call<{ versions: VersionMetaDto[] }>(`/api/receivables/sheets/${sheetId}/versions`)).versions,
    enabled,
  });
}

export function useVersion(versionId: string | null) {
  return useQuery({
    queryKey: ['receivables', 'version', versionId],
    queryFn: async () => (await call<{ version: VersionDto }>(`/api/receivables/versions/${versionId}`)).version,
    enabled: Boolean(versionId),
  });
}

/** The summary email, built from the published version. Fetched fresh each time the dialog opens. */
export function useSummary(sheetId: string, open: boolean) {
  return useQuery({
    queryKey: ['receivables', 'summary', sheetId],
    queryFn: () => call<SummaryDto>(`/api/receivables/sheets/${sheetId}/summary`),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

/** The signed-in person's Outlook link (the same status the settings page shows). */
export function useOutlookStatus() {
  return useQuery({ queryKey: ['outlook', 'status'], queryFn: () => call<OutlookStatusDto>('/api/outlook') });
}

/** Send email: one email per person (a partner's own invoices, or the whole sheet). */
export type SummarySendInput = { emails: SummaryEmailDto[] };

/** The 202 of Send: the send is logged as `sending` and finishes after the response. */
export type SummarySendQueued = { ok: true; queued: true; sendId: string; from: string; emails: number; to: number; cc: number; bcc: number };

export function useSendSummary(sheetId: string) {
  return useMutation({
    mutationFn: (input: SummarySendInput) => call<SummarySendQueued>(`/api/receivables/sheets/${sheetId}/send-summary`, json('POST', input)),
  });
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polls one queued summary send until it is sent or failed, for about three minutes. A plain
 * function, not a hook, so closing the dialog does not stop it. `error` is ready to show.
 */
export async function summarySendOutcome(sheetId: string, sendId: string): Promise<{ status: 'sending' | 'sent' | 'failed'; error: string | null }> {
  for (let i = 0; i < 90; i++) {
    await pause(2000);
    const s = await call<{ status: 'sending' | 'sent' | 'failed'; error: string | null }>(`/api/receivables/sheets/${sheetId}/send-summary?send=${sendId}`).catch(() => null);
    if (s && s.status !== 'sending') return { status: s.status, error: s.error ? ERROR_TEXT[s.error] || s.error : null };
  }
  return { status: 'sending', error: null };
}

/** All the writes of the manager area, each refetching the sheet (and versions after Update). */
export function useReceivablesActions(sheetId: string) {
  const qc = useQueryClient();
  const onSettled = () => qc.invalidateQueries({ queryKey: sheetKey(sheetId) });
  const sheetUrl = `/api/receivables/sheets/${sheetId}`;
  return {
    addInvoice: useMutation({ mutationFn: (input: InvoiceInput) => call(`${sheetUrl}/invoices`, json('POST', input)), onSettled }),
    updateInvoice: useMutation({ mutationFn: ({ id, patch }: { id: string; patch: InvoicePatch }) => call(`/api/receivables/invoices/${id}`, json('PATCH', patch)), onSettled }),
    deleteInvoice: useMutation({ mutationFn: (id: string) => call(`/api/receivables/invoices/${id}`, json('DELETE')), onSettled }),
    markReceived: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & ReceiptInput) => call(`/api/receivables/invoices/${id}/received`, json('POST', body)),
      onSettled,
    }),
    reopen: useMutation({ mutationFn: (id: string) => call(`/api/receivables/invoices/${id}/received`, json('DELETE')), onSettled }),
    pause: useMutation({
      mutationFn: ({ id, ...body }: { id: string; until: string | null; reason?: string | null }) => call(`/api/receivables/invoices/${id}/pause`, json('PUT', body)),
      onSettled,
    }),
    publish: useMutation({
      mutationFn: (note?: string) => call<{ version: VersionMetaDto }>(`${sheetUrl}/publish`, json('POST', { note })),
      onSettled: () => Promise.all([onSettled(), qc.invalidateQueries({ queryKey: versionsKey(sheetId) })]),
    }),
    addPartner: useMutation({ mutationFn: (input: { name: string; email: string }) => call(`${sheetUrl}/partners`, json('POST', input)), onSettled }),
    updatePartner: useMutation({
      mutationFn: ({ id, ...patch }: { id: string; name?: string; email?: string; active?: boolean; notifyOnPublish?: boolean; notifyNewInvoice?: boolean; notifyRollup?: boolean }) =>
        call(`/api/receivables/partners/${id}`, json('PATCH', patch)),
      onSettled,
    }),
  };
}

export type PartnerLoginActionName = 'invite' | 'resend' | 'reset' | 'disable' | 'enable';

/** Phase 8: a URL-safe set-password token made in the browser (32 random bytes); the server keeps its hash. */
function makeSetPasswordToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Phase 8: invite, resend, reset password, disable or enable a client partner's login. */
export function usePartnerLogin(sheetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: PartnerLoginActionName }) =>
      call<{ partner: PartnerDto; emailed: boolean | null }>(
        `/api/receivables/partners/${id}/login`,
        json('POST', { action, ...(action === 'invite' || action === 'resend' || action === 'reset' ? { setPasswordToken: makeSetPasswordToken() } : {}) }),
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: sheetKey(sheetId) }),
  });
}

const notesKey = (invoiceId: string) => ['receivables', 'notes', invoiceId] as const;

/** Phase 8: the notes on one invoice, fetched while the notes dialog is open. */
export function useInvoiceNotes(invoiceId: string | null) {
  return useQuery({
    queryKey: notesKey(invoiceId ?? ''),
    queryFn: async () => (await call<{ notes: InvoiceNoteDto[] }>(`/api/receivables/invoices/${invoiceId}/notes`)).notes,
    enabled: Boolean(invoiceId),
  });
}

/** Phase 8: an SBC reply on an invoice; refreshes the notes and the sheet's note count. */
export function useAddSbcNote(sheetId: string, invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => call<{ note: InvoiceNoteDto }>(`/api/receivables/invoices/${invoiceId}/notes`, json('POST', { text })),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: notesKey(invoiceId) }), qc.invalidateQueries({ queryKey: sheetKey(sheetId) })]),
  });
}

/** Phase 10: the changes the next Update publishes, fetched while the "What changes" list is open. */
export function usePendingChanges(sheetId: string, enabled: boolean, unpublished: number) {
  return useQuery({
    // The unpublished count is part of the key, so a new edit refetches the list.
    queryKey: ['receivables', 'changes', sheetId, unpublished] as const,
    queryFn: () => call<PendingChangesDto>(`/api/receivables/sheets/${sheetId}/changes`),
    enabled,
  });
}

/** Phase 10: one invoice's history (changes, reminders and notes), newest first, while the drawer is open. */
export function useInvoiceHistory(invoiceId: string | null) {
  return useQuery({
    queryKey: ['receivables', 'history', invoiceId ?? ''] as const,
    queryFn: () => call<InvoiceHistoryDto>(`/api/receivables/invoices/${invoiceId}/history`),
    enabled: Boolean(invoiceId),
  });
}

export type BulkResult = { done: number; failed: Array<{ id: string; error: string }> };

/**
 * Phase 10: the sheet's bulk actions. Each runs the single-invoice route once per invoice, one
 * after another (the same checks and change rows as a single edit), and refetches the sheet once
 * at the end. A failure on one invoice does not stop the rest; the result lists what failed.
 */
export function useBulkInvoiceActions(sheetId: string) {
  const qc = useQueryClient();
  const run = async (ids: string[], one: (id: string) => Promise<unknown>): Promise<BulkResult> => {
    const out: BulkResult = { done: 0, failed: [] };
    try {
      for (const id of ids) {
        try {
          await one(id);
          out.done += 1;
        } catch (e) {
          out.failed.push({ id, error: e instanceof Error ? e.message : 'Something went wrong. Try again.' });
        }
      }
    } finally {
      await qc.invalidateQueries({ queryKey: sheetKey(sheetId) });
    }
    return out;
  };
  return {
    markReceived: useMutation({
      mutationFn: ({ items, paidOn }: { items: Array<{ id: string; amount: number }>; paidOn: string }) => {
        const amounts = new Map(items.map((i) => [i.id, i.amount]));
        return run(
          items.map((i) => i.id),
          (id) => call(`/api/receivables/invoices/${id}/received`, json('POST', { paidOn, amount: amounts.get(id), part: false })),
        );
      },
    }),
    assignPartner: useMutation({
      mutationFn: ({ ids, partnerId }: { ids: string[]; partnerId: string | null }) => run(ids, (id) => call(`/api/receivables/invoices/${id}`, json('PATCH', { partnerId }))),
    }),
    pause: useMutation({
      mutationFn: ({ ids, until, reason }: { ids: string[]; until: string | null; reason: string | null }) => run(ids, (id) => call(`/api/receivables/invoices/${id}/pause`, json('PUT', { until, reason }))),
    }),
  };
}
