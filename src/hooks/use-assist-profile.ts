'use client';

import { useQuery } from '@tanstack/react-query';

import { assistProfileApiPath } from '@/lib/assist-profile/paths';
import type { AssistProfileResult } from '@/lib/assist-profile/types';
import { apiFetch } from '@/lib/engagements-db';

export const ASSIST_PROFILE_QUERY_KEY = 'assist-profile';

export async function fetchAssistProfile(engagementId: string): Promise<AssistProfileResult> {
  const body = await apiFetch<{ ok: true } & AssistProfileResult>(assistProfileApiPath(engagementId), {
    fallbackError: 'Could not load the Assist profile.',
  });
  const { schemaVersion, companyName, profile, missing, notes } = body;
  return { schemaVersion, companyName, profile, missing, notes };
}

/** The VCFO Assist profile for one engagement. Read-only; derived on every request. */
export function useAssistProfile(engagementId: string | null | undefined) {
  return useQuery({
    queryKey: [ASSIST_PROFILE_QUERY_KEY, engagementId ?? ''] as const,
    queryFn: () => fetchAssistProfile(engagementId as string),
    enabled: Boolean(engagementId),
    staleTime: 15_000,
  });
}
