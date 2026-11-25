'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ZohoStatusDto } from '@/lib/integrations/zoho/wire';
import type { LinkVcfoType } from '@/db/schema-integrations';

/** React Query hooks for the firm's Zoho card (Firm settings > Integrations). */

export const ZOHO_KEY = ['integrations', 'zoho'] as const;

async function json<T>(res: Response, fallback: string): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || fallback);
  return body;
}

export function useZohoStatus() {
  return useQuery({
    queryKey: ZOHO_KEY,
    queryFn: async () => json<ZohoStatusDto>(await fetch('/api/integrations/zoho'), 'Could not load Zoho'),
    // Discovery runs in the background; poll while it does.
    refetchInterval: (q) => {
      const s = q.state.data?.job?.status;
      return s === 'queued' || s === 'running' ? 2000 : false;
    },
    staleTime: 10_000,
  });
}

export type ZohoTargetOption = { vcfoType: Exclude<LinkVcfoType, 'firm'>; vcfoId: string; name: string; detail: string | null };

export function useZohoTargets(enabled: boolean) {
  return useQuery({
    queryKey: [...ZOHO_KEY, 'targets'],
    queryFn: async () => (await json<{ targets: ZohoTargetOption[] }>(await fetch('/api/integrations/zoho/links'), 'Could not load clients')).targets,
    enabled,
    staleTime: 60_000,
  });
}

export type ZohoLinkAction =
  | { action: 'accept_all' }
  | { linkId: string; action: 'accept' | 'ignore' | 'clear' }
  | { linkId: string; action: 'set'; vcfoType: LinkVcfoType; vcfoId: string | null };

export function useZohoActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ZOHO_KEY });
  const decide = useMutation({
    mutationFn: async (body: ZohoLinkAction) =>
      json<{ ok: true }>(await fetch('/api/integrations/zoho/links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), 'Could not save'),
    onSuccess: refresh,
  });
  const rediscover = useMutation({
    mutationFn: async () => json<{ ok: true }>(await fetch('/api/integrations/zoho/discover', { method: 'POST' }), 'Could not start discovery'),
    onSuccess: refresh,
  });
  const disconnect = useMutation({
    mutationFn: async () => json<{ ok: true; revokedAtZoho: boolean }>(await fetch('/api/integrations/zoho/disconnect', { method: 'POST' }), 'Could not disconnect'),
    onSuccess: refresh,
  });
  return { decide, rediscover, disconnect };
}
