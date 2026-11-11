'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssistAgentRunView, AssistAttestationView, AssistPatchStatus, AssistPatchView } from '@/lib/assist-agents/types';

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'request_failed');
  return data;
}

/** Recent VCFO Assist agent runs in the viewer's scope (`GET /api/assist/agent-runs`). */
export function useAssistAgentRuns() {
  return useQuery({
    queryKey: ['assist-agent-runs'],
    queryFn: async () => readJson<{ runs: AssistAgentRunView[] }>(await fetch('/api/assist/agent-runs?limit=100')),
    // A run in progress reports every few seconds, so the list looks again while one is open.
    refetchInterval: (query) => (query.state.data?.runs.some((r) => r.status === 'running' || r.status === 'waiting_user') ? 10_000 : false),
  });
}

export function useAssistPatches(status: AssistPatchStatus | 'all') {
  return useQuery({
    queryKey: ['assist-patches', status],
    queryFn: async () =>
      readJson<{ patches: AssistPatchView[] }>(await fetch(`/api/assist/patches${status === 'all' ? '' : `?status=${status}`}`)),
  });
}

export function useReviewAssistPatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: 'approved' | 'rejected' }) =>
      readJson<{ patch: AssistPatchView }>(
        await fetch(`/api/assist/patches/${id}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision }),
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assist-patches'] }),
  });
}

export interface AssistAttestationBody {
  checks: { fieldsCheckedAgainstRecords: true; registeredOffice?: 'visited' | 'owner_noc'; subscriberSignatures?: 'in_presence' | 'video_kyc' };
  evidenceDocumentIds: string[];
  note?: string;
}

/** The certifier records the checks for one run (`POST .../assist-runs/[runId]/attestation`, SAFETY.md G17). */
export function useRecordAssistAttestation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ engagementId, runId, body }: { engagementId: string; runId: string; body: AssistAttestationBody }) =>
      readJson<{ attestation: AssistAttestationView }>(
        await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/assist-runs/${runId}/attestation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assist-agent-runs'] }),
  });
}

/** The engagement's vault documents, to offer as attestation evidence (`GET /api/documents?engagementId=`). */
export function useAssistEvidenceDocuments(engagementId: string | null) {
  return useQuery({
    queryKey: ['assist-evidence-documents', engagementId],
    enabled: Boolean(engagementId),
    queryFn: async () =>
      readJson<{ documents: Array<{ id: string; fileName: string; createdAt?: string }> }>(
        await fetch(`/api/documents?engagementId=${encodeURIComponent(engagementId ?? '')}`),
      ),
  });
}
