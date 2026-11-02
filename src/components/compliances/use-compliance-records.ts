'use client';

/**
 * React Query hooks for the compliance record parts built on migration 0029, shared by the
 * staff records (`src/views/compliances/*`) and the client portal pages:
 *  - VCFO Assist runs (`/api/assist/runs`);
 *  - the "From the client" and "Filled by SBC" inputs (`/api/compliance-inputs`);
 *  - why a registration applies and what it starts (`/api/registrations/applicability`).
 * A client calls them without an engagement id and gets its own engagement.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssistRunDto, AssistSubjectKind } from '@/lib/assist-runs/runs';
import type { SubjectInputsDto } from '@/db/repositories/compliance-inputs';
import type { ComplianceStarts } from '@/db/repositories/registration-applicability';

export type { SubjectInputsDto, ComplianceStarts };
export type { SubjectDoc, SubjectField, DocWord } from '@/db/repositories/compliance-inputs';
export type { RegistrationApplicability, StartedObligation } from '@/db/repositories/registration-applicability';

async function readJson<T>(res: Response, what: string): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error && body.error !== 'not_found' ? body.error : `Could not load ${what}`);
  return body;
}

/* ------------------------------------------------------------------ VCFO Assist */

export function useAssistRuns(input: { engagementId?: string | null; kind?: AssistSubjectKind; key?: string | null; enabled?: boolean }) {
  const qs = new URLSearchParams();
  if (input.engagementId) qs.set('engagementId', input.engagementId);
  if (input.kind) qs.set('kind', input.kind);
  if (input.key) qs.set('key', input.key);
  return useQuery({
    queryKey: ['assist-runs', input.engagementId ?? 'mine', input.kind ?? 'all', input.key ?? 'all'],
    enabled: input.enabled !== false,
    queryFn: async () => readJson<{ setUp: boolean; runs: AssistRunDto[] }>(await fetch(`/api/assist/runs?${qs}`, { cache: 'no-store' }), 'VCFO Assist'),
    staleTime: 15_000,
    // A running run refreshes while the page is open.
    refetchInterval: (q) => (q.state.data?.runs.some((r) => r.state === 'running' || r.state === 'requested') ? 10_000 : false),
  });
}

export function useStartAssist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { engagementId: string; kind: AssistSubjectKind; key: string; form?: string | null }) =>
      readJson<{ run: AssistRunDto }>(
        await fetch('/api/assist/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, form: body.form ?? undefined }) }),
        'VCFO Assist',
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: ['assist-runs'] }),
  });
}

/** Same-origin link to a step's screenshot. */
export function assistShotHref(runId: string, index: number): string {
  return `/api/assist/runs/${encodeURIComponent(runId)}/shots/${index}`;
}

/* ------------------------------------------------------------------ inputs */

export function useSubjectInputs(input: { engagementId?: string | null; kind: 'obligation' | 'registration'; key: string | null | undefined; enabled?: boolean }) {
  const qs = new URLSearchParams({ kind: input.kind, key: input.key ?? '' });
  if (input.engagementId) qs.set('engagementId', input.engagementId);
  return useQuery({
    queryKey: ['compliance-inputs', input.engagementId ?? 'mine', input.kind, input.key ?? ''],
    enabled: input.enabled !== false && Boolean(input.key),
    queryFn: async () =>
      (await readJson<{ inputs: SubjectInputsDto }>(await fetch(`/api/compliance-inputs?${qs}`, { cache: 'no-store' }), 'the details')).inputs,
    staleTime: 15_000,
  });
}

export type InputsAction =
  | { action: 'save'; engagementId?: string; kind: 'obligation' | 'registration'; key: string; side: 'client' | 'sbc'; values: Record<string, string | null> }
  | { action: 'confirm'; engagementId: string; kind: 'obligation' | 'registration'; key: string }
  | { action: 'ask'; engagementId: string; kind: 'obligation' | 'registration'; key: string; label: string; dueOn?: string }
  | { action: 'accept'; requestId: string }
  | { action: 'send-back'; requestId: string; reason: string };

export function useInputsAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: InputsAction) =>
      readJson<{ ok: true; requestId?: string }>(
        await fetch('/api/compliance-inputs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        'the change',
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: ['compliance-inputs'] }),
  });
}

/* ------------------------------------------------------------------ applicability */

export function useComplianceStarts(engagementId?: string | null, enabled = true) {
  const qs = engagementId ? `?engagementId=${encodeURIComponent(engagementId)}` : '';
  return useQuery({
    queryKey: ['compliance-starts', engagementId ?? 'mine'],
    enabled,
    queryFn: async () =>
      (await readJson<{ starts: ComplianceStarts }>(await fetch(`/api/registrations/applicability${qs}`, { cache: 'no-store' }), 'the registration rules')).starts,
    staleTime: 60_000,
  });
}
