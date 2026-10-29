'use client';

import { useQuery } from '@tanstack/react-query';
import type { LeadHours } from '@/db/repositories/lead-hours';

/** Hours each project lead planned this week (`GET /api/metrics/lead-hours`, F-163). */
export function useLeadHours(enabled = true) {
  return useQuery({
    queryKey: ['metrics', 'lead-hours'],
    queryFn: async (): Promise<{ weekStart: string; leads: LeadHours[] }> => {
      const res = await fetch('/api/metrics/lead-hours');
      if (!res.ok) throw new Error('Could not load the planned hours');
      return (await res.json()) as { weekStart: string; leads: LeadHours[] };
    },
    staleTime: 5 * 60_000,
    enabled,
  });
}
