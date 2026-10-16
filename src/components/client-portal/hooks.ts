'use client';

/**
 * Shared data hooks for client portal pages.
 *
 *  - `useMyEngagement()` — the signed-in client's engagement + its (already
 *    client-redacted) checklist state from `useApp()`.
 *  - `usePortalIncorporation()` — the step model (`buildIncorporationModel`)
 *    for that engagement: every page that shows steps reads this.
 */
import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { findEngagementForClientUser } from '@/lib/checklist-state-key';
import { buildIncorporationModel, type PortalIncorporationModel } from '@/lib/client-portal/step-model';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItemState } from '@/context/AppContext';

export function useMyEngagement(): {
  engagement: Engagement | undefined;
  state: Record<string, ChecklistItemState>;
  loading: boolean;
} {
  const { user, engagements, engagementsSettled, getStateForEngagement } = useApp();
  const engagement = useMemo(
    () => (user ? findEngagementForClientUser(engagements, user) ?? engagements[0] : undefined),
    [user, engagements],
  );
  const state = engagement ? getStateForEngagement(engagement) : {};
  return { engagement, state, loading: !engagementsSettled };
}

/** Today in India (yyyy-mm-dd) — the firm works on IST dates. */
export function todayIST(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

export function usePortalIncorporation(): {
  model: PortalIncorporationModel;
  engagement: Engagement | undefined;
  loading: boolean;
} {
  const { engagement, state, loading } = useMyEngagement();
  const model = useMemo(
    () => buildIncorporationModel(state as never, engagement?.schedule ?? null, todayIST()),
    [state, engagement?.schedule],
  );
  return { model, engagement, loading };
}
