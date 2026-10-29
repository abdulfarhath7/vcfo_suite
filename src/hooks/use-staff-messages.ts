'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/context/app-provider/fetch-json';
import type { Message, MessageTriage, MessageTriageFilter } from '@/lib/messages/types';

/**
 * Staff side of client messages (G-11): the triage lists, one engagement's thread, and the
 * triage and reply writes. Every list lives under the `['staff-messages']` key, so a write
 * refreshes all of them.
 */

const ROOT = ['staff-messages'] as const;

export function useStaffMessages(triage: MessageTriageFilter, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...ROOT, 'list', triage],
    queryFn: async () =>
      (await fetchJson<{ messages: Message[] }>(`/api/messages?triage=${triage}`)).messages,
    enabled: opts.enabled ?? true,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useMessageThread(engagementId: string | null) {
  return useQuery({
    queryKey: [...ROOT, 'thread', engagementId],
    queryFn: async () =>
      (
        await fetchJson<{ messages: Message[] }>(
          `/api/messages?triage=all&engagementId=${encodeURIComponent(engagementId ?? '')}`,
        )
      ).messages,
    enabled: Boolean(engagementId),
    staleTime: 15_000,
  });
}

export function useSetMessageTriage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; triage: MessageTriage }) =>
      (
        await fetchJson<{ message: Message }>(`/api/messages/${encodeURIComponent(input.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ triage: input.triage }),
        })
      ).message,
    onSettled: () => qc.invalidateQueries({ queryKey: ROOT }),
  });
}

export function useReplyToClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { engagementId: string; body: string; itemKey?: string | null }) =>
      (
        await fetchJson<{ message: Message }>('/api/messages', {
          method: 'POST',
          body: JSON.stringify(input),
        })
      ).message,
    onSettled: () => qc.invalidateQueries({ queryKey: ROOT }),
  });
}
