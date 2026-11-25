'use client';

/**
 * Sync from Zoho on the Sheet tab (docs/specs/integrations/ZOHO.md): the sheet's source and Zoho
 * state, choosing the source, queueing a sync and polling it. TanStack Query over
 * /api/receivables/sheets/:id/{source,zoho}; the repository behind the routes scopes by AuthContext.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TallyJobDto, TallyJobType } from '@/lib/receivables/tally-live/wire';
import type { SheetSource, ZohoSheetStatusDto } from '@/lib/integrations/zoho/wire';
import { call, json } from './use-receivables';

export const sheetSourceKey = (sheetId: string) => ['receivables', 'source', sheetId] as const;
export const zohoJobKey = (sheetId: string, jobId: string | null) => ['receivables', 'source', sheetId, 'job', jobId] as const;

const isActive = (job: TallyJobDto | null | undefined) => job?.status === 'queued' || job?.status === 'running';

export function useSheetSource(sheetId: string) {
  return useQuery({
    queryKey: sheetSourceKey(sheetId),
    queryFn: () => call<ZohoSheetStatusDto>(`/api/receivables/sheets/${sheetId}/source`),
    staleTime: 30_000,
  });
}

export function useZohoSheetJob(sheetId: string, jobId: string | null) {
  return useQuery({
    queryKey: zohoJobKey(sheetId, jobId),
    queryFn: async () => (await call<{ job: TallyJobDto }>(`/api/receivables/sheets/${sheetId}/zoho/jobs/${jobId}`)).job,
    enabled: Boolean(jobId),
    refetchInterval: (q) => (isActive(q.state.data) || !q.state.data ? 2_000 : false),
  });
}

export function useSheetSourceActions(sheetId: string) {
  const qc = useQueryClient();
  const onSettled = () => qc.invalidateQueries({ queryKey: sheetSourceKey(sheetId) });
  return {
    setSource: useMutation({
      mutationFn: (input: { source: SheetSource; zohoApp?: 'books' | 'invoice'; zohoOrgId?: string }) =>
        call<ZohoSheetStatusDto>(`/api/receivables/sheets/${sheetId}/source`, json('PATCH', input)),
      onSettled,
    }),
    sync: useMutation({
      mutationFn: async (input: { type: TallyJobType; from: string; to: string }) =>
        (await call<{ job: TallyJobDto }>(`/api/receivables/sheets/${sheetId}/zoho/sync`, json('POST', input))).job,
      onSettled,
    }),
  };
}
