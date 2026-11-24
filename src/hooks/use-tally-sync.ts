'use client';

/**
 * Tally live sync on the Sheet tab (docs/specs/receivables/TALLY-LIVE.md): the connector's status,
 * pairing, Disconnect, queueing a sync and polling it. TanStack Query over
 * /api/receivables/sheets/:id/tally; the repository behind the routes scopes by AuthContext.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PairingCodeDto, TallyJobDto, TallyJobType, TallyStatusDto } from '@/lib/receivables/tally-live/wire';
import { call, json } from './use-receivables';

export const tallyKey = (sheetId: string) => ['receivables', 'tally', sheetId] as const;
export const tallyJobKey = (sheetId: string, jobId: string | null) => ['receivables', 'tally', sheetId, 'job', jobId] as const;

const isActive = (job: TallyJobDto | null | undefined) => job?.status === 'queued' || job?.status === 'running';

/** The connector's status; refreshed every 30 s so the online dot stays true (every 3 s while pairing). */
export function useTallyStatus(sheetId: string, pairing = false) {
  return useQuery({
    queryKey: tallyKey(sheetId),
    queryFn: () => call<TallyStatusDto>(`/api/receivables/sheets/${sheetId}/tally`),
    refetchInterval: pairing ? 3_000 : 30_000,
  });
}

/** One sync, polled every 2 s while it is queued or running. */
export function useTallyJob(sheetId: string, jobId: string | null) {
  return useQuery({
    queryKey: tallyJobKey(sheetId, jobId),
    queryFn: async () => (await call<{ job: TallyJobDto }>(`/api/receivables/sheets/${sheetId}/tally/jobs/${jobId}`)).job,
    enabled: Boolean(jobId),
    refetchInterval: (q) => (isActive(q.state.data) || !q.state.data ? 2_000 : false),
  });
}

export function useTallyActions(sheetId: string) {
  const qc = useQueryClient();
  const base = `/api/receivables/sheets/${sheetId}/tally`;
  const onSettled = () => qc.invalidateQueries({ queryKey: tallyKey(sheetId) });
  return {
    pair: useMutation({ mutationFn: () => call<PairingCodeDto>(`${base}/pair`, json('POST')), onSettled }),
    revoke: useMutation({ mutationFn: () => call<{ revoked: number }>(`${base}/revoke`, json('POST')), onSettled }),
    sync: useMutation({
      mutationFn: async (input: { type: TallyJobType; from: string; to: string }) => (await call<{ job: TallyJobDto }>(`${base}/sync`, json('POST', input))).job,
      onSettled,
    }),
  };
}
