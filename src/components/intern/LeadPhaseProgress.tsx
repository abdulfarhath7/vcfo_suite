'use client';

import { useMemo } from 'react';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { PhaseProgressGrid } from '@/components/staff/today/PhaseProgressGrid';
import { buildPhaseProgressRows } from '@/components/staff/today/today-rows';

/* The lead's Phase progress (prototype PhaseProgress): one row per company with the ST5 phase
   track (R-22), the current step, steps done and days to the incorporation date. Each row
   opens the company. Only companies still incorporating are listed (nearest COI first), and
   the card is left out when there are none. */
export function LeadPhaseProgress({
  engagements,
  getState,
}: {
  engagements: Engagement[];
  getState: (engagement: Engagement) => Record<string, ChecklistItemStateSlice>;
}) {
  const now = useMemo(() => new Date(), []);
  const rows = useMemo(
    () =>
      buildPhaseProgressRows({ engagements, getState, now })
        .filter((r) => !r.incorporated)
        .sort((a, b) => (a.daysToCoi ?? 9999) - (b.daysToCoi ?? 9999) || a.companyName.localeCompare(b.companyName)),
    [engagements, getState, now],
  );
  if (rows.length === 0) return null;
  return <PhaseProgressGrid rows={rows} meta={`${rows.length} incorporating`} empty="No company is incorporating." />;
}
