'use client';

import { useQuery } from '@tanstack/react-query';
import type { ObligationAbout } from '@/lib/obligations/about';

export type { ObligationAbout };

/**
 * The About, Why it applies and If filed late facts of one obligation (G-04), from
 * `GET /api/obligations/about`. Staff pass the obligation id; the client portal passes one
 * of its filing ids. A 404 (out of scope) reads as null, never as an error state.
 */
export function useObligationAbout(input: { obligationId?: string | null; instanceId?: string | null }) {
  const obligationId = input.obligationId?.trim() || null;
  const instanceId = input.instanceId?.trim() || null;
  return useQuery({
    queryKey: ['obligation-about', obligationId, instanceId],
    enabled: Boolean(obligationId || instanceId),
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async (): Promise<ObligationAbout | null> => {
      const q = new URLSearchParams();
      if (obligationId) q.set('obligationId', obligationId);
      if (instanceId) q.set('instanceId', instanceId);
      const res = await fetch(`/api/obligations/about?${q.toString()}`, { cache: 'no-store' });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(String(res.status));
      return ((await res.json()) as { about: ObligationAbout }).about;
    },
  });
}

/** "Why it applies": the library's reason, then the obligation's own applicability note. */
export function whyItAppliesLine(about: Pick<ObligationAbout, 'whyItApplies' | 'applicabilityNote' | 'isConditional'>): string | null {
  const note = about.applicabilityNote ? `${about.isConditional ? 'Applies only with: ' : 'Note: '}${about.applicabilityNote}.` : null;
  const parts = [about.whyItApplies, note].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}
