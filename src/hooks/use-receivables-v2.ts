'use client';

/**
 * Receivables v2 data (docs/specs/receivables/V2.md): the Tally import and approval panel, staff
 * amount changes, and the People tab. TanStack Query over /api/receivables; each repository behind
 * the routes scopes by the caller's AuthContext. Writes refetch the sheet, so the invoice rows
 * and the approval panel stay in step.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApproveEdit, ClientDto, DigestRecipientDto, EmailSettingsDto, ImportRowDto, PeopleDto, PendingImportsDto, ReceivedEmailDraftDto } from '@/lib/receivables/v2-wire';
import { call, json, sheetKey } from './use-receivables';

export const pendingKey = (sheetId: string) => ['receivables', 'imports', sheetId] as const;
export const peopleKey = (sheetId: string) => ['receivables', 'people', sheetId] as const;

/** The approval panel's rows: the pending Tally batch and the staff amount changes. */
export function usePendingImports(sheetId: string) {
  return useQuery({ queryKey: pendingKey(sheetId), queryFn: () => call<PendingImportsDto>(`/api/receivables/sheets/${sheetId}/imports/pending`) });
}

export type ApproveResult = { approved: number; invoiceIds: string[]; refused: Array<{ rowId: string; code: string }> };

export function useImportActions(sheetId: string) {
  const qc = useQueryClient();
  const base = `/api/receivables/sheets/${sheetId}/imports`;
  const onSettled = () =>
    Promise.all([qc.invalidateQueries({ queryKey: pendingKey(sheetId) }), qc.invalidateQueries({ queryKey: sheetKey(sheetId) }), qc.invalidateQueries({ queryKey: peopleKey(sheetId) })]);
  return {
    upload: useMutation({
      mutationFn: (file: File) => {
        const form = new FormData();
        form.set('file', file);
        return call<PendingImportsDto>(base, { method: 'POST', body: form });
      },
      onSettled,
    }),
    approve: useMutation({ mutationFn: (input: { rowIds: string[]; edits: ApproveEdit[] }) => call<ApproveResult>(`${base}/approve`, json('POST', input)), onSettled }),
    reject: useMutation({ mutationFn: (rowIds: string[]) => call<{ rejected: number }>(`${base}/reject`, json('POST', { rowIds })), onSettled }),
    discard: useMutation({ mutationFn: (batchId: string) => call(`${base}/${batchId}`, json('DELETE')), onSettled }),
    changeAmount: useMutation({
      mutationFn: ({ invoiceId, ...body }: { invoiceId: string; amountInr: number; reason: string }) => call<{ row: ImportRowDto }>(`/api/receivables/invoices/${invoiceId}/amount-change`, json('POST', body)),
      onSettled,
    }),
  };
}

/** The People tab: clients, digest recipients, the email settings and log, the WhatsApp card. */
export function usePeople(sheetId: string) {
  return useQuery({ queryKey: peopleKey(sheetId), queryFn: () => call<PeopleDto>(`/api/receivables/sheets/${sheetId}/people`) });
}

export type ClientWrite = { name?: string; partnerId?: string | null; creditDays?: number; billingEmail?: string | null; billingCc?: string[]; gstin?: string | null; active?: boolean };

export function usePeopleActions(sheetId: string) {
  const qc = useQueryClient();
  const sheetUrl = `/api/receivables/sheets/${sheetId}`;
  const onSettled = () => Promise.all([qc.invalidateQueries({ queryKey: peopleKey(sheetId) }), qc.invalidateQueries({ queryKey: sheetKey(sheetId) })]);
  return {
    saveSettings: useMutation({ mutationFn: (patch: Partial<EmailSettingsDto>) => call<{ settings: EmailSettingsDto }>(`${sheetUrl}/email-settings`, json('PATCH', patch)), onSettled }),
    addClient: useMutation({ mutationFn: (input: ClientWrite & { name: string }) => call<{ client: ClientDto }>(`${sheetUrl}/clients`, json('POST', input)), onSettled }),
    updateClient: useMutation({ mutationFn: ({ id, ...patch }: ClientWrite & { id: string }) => call<{ client: ClientDto }>(`/api/receivables/clients/${id}`, json('PATCH', patch)), onSettled }),
    setPartnerClients: useMutation({
      mutationFn: ({ partnerId, clientIds }: { partnerId: string; clientIds: string[] }) => call(`/api/receivables/partners/${partnerId}/clients`, json('PUT', { clientIds })),
      onSettled,
    }),
    addRecipient: useMutation({ mutationFn: (input: { name: string; email: string }) => call<{ recipient: DigestRecipientDto }>(`${sheetUrl}/digest-recipients`, json('POST', input)), onSettled }),
    updateRecipient: useMutation({
      mutationFn: ({ id, ...patch }: { id: string; name?: string; email?: string; active?: boolean }) => call(`/api/receivables/digest-recipients/${id}`, json('PATCH', patch)),
      onSettled,
    }),
    removeRecipient: useMutation({ mutationFn: (id: string) => call(`/api/receivables/digest-recipients/${id}`, json('DELETE')), onSettled }),
    sendStatement: useMutation({ mutationFn: (clientId: string) => call<{ ok: true; queued: true; logId: string }>(`/api/receivables/clients/${clientId}/statement`, json('POST')), onSettled }),
    retryEmail: useMutation({ mutationFn: (logId: string) => call<{ ok: true; queued: true }>(`/api/receivables/email-log/${logId}/retry`, json('POST')), onSettled }),
    testWhatsApp: useMutation({ mutationFn: () => call<{ ok: true; to: string }>(`${sheetUrl}/whatsapp-test`, json('POST')) }),
  };
}

/** The "Payment received" pop-up after Mark received: its draft, and the send (only on the person's click). */
export function useReceivedEmail(sheetId: string, invoiceIds: string[]) {
  const qc = useQueryClient();
  const draft = useQuery({
    queryKey: ['receivables', 'received-email', sheetId, invoiceIds.join(',')],
    queryFn: () => call<ReceivedEmailDraftDto>(`/api/receivables/sheets/${sheetId}/received-email?ids=${invoiceIds.join(',')}`),
    enabled: invoiceIds.length > 0,
  });
  const send = useMutation({
    mutationFn: (input: { invoiceIds: string[]; to: Array<{ name: string; email: string }>; cc: Array<{ name: string; email: string }>; subject: string; html: string }) =>
      call<{ ok: true; queued: true; logId: string }>(`/api/receivables/sheets/${sheetId}/received-email`, json('POST', input)),
    onSettled: () => qc.invalidateQueries({ queryKey: peopleKey(sheetId) }),
  });
  return { draft, send };
}
