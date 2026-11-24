'use client';

import { useQuery } from '@tanstack/react-query';
import type { StepFieldState } from '@/lib/steps/field-states';

/**
 * The per-field review states (`step_field_states`) of one step, or of the whole engagement
 * when `itemId` is left out, through `GET /api/engagements/:id/field-states`. Staff get every
 * state; a client gets only the fields SBC asked for or sent back. The staff step page (field
 * review), the client step page and the client home share this one read.
 */
export function stepFieldStatesKey(engagementId: string, itemId?: string) {
  return itemId ? (['step-field-states', engagementId, itemId] as const) : (['step-field-states', engagementId] as const);
}

export function useStepFieldStates(engagementId: string | undefined, itemId?: string, enabled = true) {
  return useQuery({
    queryKey: stepFieldStatesKey(engagementId ?? '', itemId),
    enabled: Boolean(engagementId) && enabled,
    queryFn: async (): Promise<StepFieldState[]> => {
      const q = itemId ? `?itemId=${encodeURIComponent(itemId)}` : '';
      const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId!)}/field-states${q}`);
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; states?: StepFieldState[] };
      if (!res.ok || !out.ok) throw new Error('Could not load the field states');
      return out.states ?? [];
    },
    staleTime: 30_000,
  });
}
