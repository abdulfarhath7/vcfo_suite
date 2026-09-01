'use client';

import { useQuery } from '@tanstack/react-query';
import type { FilingRow } from '@/lib/filings';

export interface FilingsResponse {
  rows: FilingRow[];
  companies: { engagementId: string; companyName: string }[];
}

/**
 * The register read. Views never touch `db` — this goes through
 * `/api/filings`, which runs the repository under the caller's `AuthContext`.
 */
export function useFilings(options: { engagementId?: string; fyStartYear?: number } = {}) {
  const { engagementId, fyStartYear } = options;
  return useQuery({
    queryKey: ['filings', engagementId ?? 'scope', fyStartYear ?? 'all'],
    queryFn: async (): Promise<FilingsResponse> => {
      const params = new URLSearchParams();
      if (engagementId) params.set('engagementId', engagementId);
      if (fyStartYear !== undefined) params.set('fy', String(fyStartYear));
      const query = params.toString();
      const res = await fetch(`/api/filings${query ? `?${query}` : ''}`);
      const data = (await res.json()) as FilingsResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not load filings');
      return { rows: data.rows ?? [], companies: data.companies ?? [] };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
