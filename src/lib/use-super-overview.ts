'use client';

import { useQuery } from '@tanstack/react-query';
import type { SuperEngagementDetail, SuperOverview } from '@/lib/super-overview';

/**
 * The one read the super admin observatory makes. Views never touch `db` — this
 * hook goes through `/api/super/overview`, which runs the repository under the
 * caller's `AuthContext`.
 */
export const SUPER_OVERVIEW_QUERY_KEY = ['super-overview'] as const;

async function fetchSuperOverview(): Promise<SuperOverview> {
  const res = await fetch('/api/super/overview');
  const data = (await res.json()) as { overview?: SuperOverview; error?: string };
  if (!res.ok || !data.overview) {
    throw new Error(data.error ?? 'Could not load the firm overview');
  }
  return data.overview;
}

export function useSuperOverview() {
  return useQuery({
    queryKey: SUPER_OVERVIEW_QUERY_KEY,
    queryFn: fetchSuperOverview,
    // A firm-wide aggregate over every engagement — fresh enough to be honest,
    // rare enough not to hammer the read.
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    notifyOnChangeProps: ['data', 'error', 'isPending'],
  });
}

/* ------------------------------------------------------------------ *
 * L2 — one engagement.
 * ------------------------------------------------------------------ */

export const SUPER_PROJECT_QUERY_KEY = ['super-project'] as const;

export type SuperProjectQueryResult = {
  detail: SuperEngagementDetail | null;
  /** True when the id does not resolve to a project this caller may see. */
  missing: boolean;
};

async function fetchSuperProject(id: string): Promise<SuperProjectQueryResult> {
  const res = await fetch(`/api/super/projects/${encodeURIComponent(id)}`);

  if (res.status === 404) {
    return { detail: null, missing: true };
  }

  const data = (await res.json()) as { detail?: SuperEngagementDetail; error?: string };
  if (!res.ok || !data.detail) {
    throw new Error(data.error ?? 'Could not load this project');
  }
  return { detail: data.detail, missing: false };
}

export function useSuperProject(id: string) {
  return useQuery({
    queryKey: [...SUPER_PROJECT_QUERY_KEY, id],
    queryFn: () => fetchSuperProject(id),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    notifyOnChangeProps: ['data', 'error', 'isPending'],
  });
}
