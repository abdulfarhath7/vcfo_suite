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
import type { TemplateKind, TemplateOverride, TemplateSet } from '@/lib/receivables/templates';

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

export type ClientWrite = { name?: string; partnerId?: string | null; coPartnerIds?: string[]; creditDays?: number; billingEmail?: string | null; billingCc?: string[]; gstin?: string | null; active?: boolean };

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
    deletePartner: useMutation({ mutationFn: (id: string) => call(`/api/receivables/partners/${id}`, json('DELETE')), onSettled }),
    deleteClient: useMutation({ mutationFn: (id: string) => call(`/api/receivables/clients/${id}`, json('DELETE')), onSettled }),
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

/** The caller's saved email sign name ("Regards, <name>"), kept until they change it. */
export function useSignName() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['receivables', 'sign-name'], queryFn: () => call<{ name: string }>('/api/receivables/sign-name'), staleTime: 60_000 });
  const save = useMutation({
    mutationFn: (name: string) => call<{ name: string }>('/api/receivables/sign-name', json('PUT', { name })),
    onSuccess: (r) => qc.setQueryData(['receivables', 'sign-name'], r),
  });
  return { query, save };
}

/** Saves the sign name if it changed; called just before an email is sent. */
export function useKeepSignName() {
  const { query, save } = useSignName();
  return (name: string) => {
    const n = name.trim();
    if (n && n !== query.data?.name) save.mutate(n);
  };
}

/** The sheet's email templates (the Templates tab, owner 19 Nov 2026). */
export type TemplatesDto = { templates: TemplateSet; stamps: Partial<Record<TemplateKind, { updatedAt: string; updatedBy: string | null }>> };
export const templatesKey = (sheetId: string) => ['receivables', 'templates', sheetId] as const;

export function useTemplates(sheetId: string) {
  const qc = useQueryClient();
  const base = `/api/receivables/sheets/${sheetId}/templates`;
  const query = useQuery({ queryKey: templatesKey(sheetId), queryFn: () => call<TemplatesDto>(base) });
  // A saved template changes the Send email and Payment received drafts too.
  const onSettled = () => qc.invalidateQueries({ queryKey: ['receivables'] });
  const save = useMutation({ mutationFn: (input: { kind: TemplateKind } & TemplateOverride) => call<{ kind: TemplateKind; template: TemplateOverride }>(base, json('PUT', input)), onSettled });
  const reset = useMutation({ mutationFn: (kind: TemplateKind) => call<{ ok: true }>(`${base}?kind=${kind}`, { method: 'DELETE' }), onSettled });
  return { query, save, reset };
}
