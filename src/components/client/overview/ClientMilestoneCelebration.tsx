'use client';

import { useEffect, useState } from 'react';
import { PhaseCelebration } from '@/components/incorporation/PhaseCelebration';
import { latestCompletedPhase, type ClientOverviewProgress } from '@/lib/client-overview';

const STORAGE_PREFIX = 'vcfo.client.phaseCelebrated.';

/**
 * Module 12 — milestone celebration.
 *
 * Reuses the existing `PhaseCelebration` ribbon (no modal, no confetti) and
 * fires it once per phase per browser: `PhaseCelebration` alone would replay on
 * every remount, which is exactly the spam §6 rules out.
 */
export function ClientMilestoneCelebration({
  engagementId,
  progress,
}: {
  engagementId: string;
  progress: ClientOverviewProgress;
}) {
  const phase = latestCompletedPhase(progress);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (!phase) return;
    const key = `${STORAGE_PREFIX}${engagementId}.${phase.id}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, new Date().toISOString());
    } catch {
      // Private mode / storage disabled — celebrate this once and move on.
    }
    setCelebrate(true);
  }, [engagementId, phase]);

  if (!phase || !celebrate) return null;

  return (
    <PhaseCelebration
      phaseId={phase.id}
      phaseTitle={`${phase.label} complete`}
      completed
      className="mb-1"
    />
  );
}
