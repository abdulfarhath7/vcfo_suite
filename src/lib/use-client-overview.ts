'use client';

import { useQuery } from '@tanstack/react-query';
import type { ClientOverview } from '@/lib/client-overview';

/**
 * The one read the client dashboard makes. Views never touch `db` — this hook
 * goes through `/api/client/overview`, which runs the repository under the
 * caller's `AuthContext`.
 */
export const CLIENT_OVERVIEW_QUERY_KEY = ['client-overview'] as const;

export type ClientOverviewQueryResult = {
  overview: ClientOverview | null;
  /** True when the caller is authenticated but has no engagement yet. */
  missing: boolean;
};

async function fetchClientOverview(engagementId?: string): Promise<ClientOverviewQueryResult> {
  const query = engagementId ? `?engagementId=${encodeURIComponent(engagementId)}` : '';
  const res = await fetch(`/api/client/overview${query}`);

  if (res.status === 404) {
    return { overview: null, missing: true };
  }

  const data = (await res.json()) as { overview?: ClientOverview; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'Could not load your dashboard');
  }
  return { overview: data.overview ?? null, missing: false };
}

export function useClientOverview(engagementId?: string) {
  return useQuery({
    queryKey: [...CLIENT_OVERVIEW_QUERY_KEY, engagementId ?? 'mine'],
    queryFn: () => fetchClientOverview(engagementId),
    // The dashboard is a reflection of work the firm does elsewhere; a short
    // stale window keeps it fresh without hammering the aggregate read.
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    notifyOnChangeProps: ['data', 'error', 'isPending'],
  });
}
