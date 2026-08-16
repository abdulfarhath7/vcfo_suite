'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { getPreIncPhases, getPhaseItems } from '@/data/checklist';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ChecklistPhaseJourney } from '@/components/incorporation/ChecklistPhaseJourney';
import { deriveChecklistDisplayStatus } from '@/lib/checklist-display-status';
import { isChecklistStepSequentiallyComplete } from '@/lib/checklist-step-gate';
import { useBoardResolutionProgress } from '@/lib/use-board-resolution-progress';
import { cn } from '@/lib/utils';

interface PreIncSectionProps {
  readOnly?: boolean;
  /** Client portal: editable response fields while status stays read-only */
  clientEditable?: boolean;
  variant?: 'admin' | 'client';
}

export function PreIncSection({
  readOnly = false,
  clientEditable = false,
  variant = 'admin',
}: PreIncSectionProps) {
  const { selectedClient, getState, getStateForEngagement, engagements } = useApp();
  const isClient = variant === 'client';
  const engagement = useMemo(
    () =>
      selectedClient
        ? engagements.find(
            (e) => e.id === selectedClient.id || e.clientId === selectedClient.id,
          )
        : undefined,
    [engagements, selectedClient],
  );
  const { snapshot: brSnapshot } = useBoardResolutionProgress(engagement?.id);

  if (!selectedClient) return null;

  const phases = getPreIncPhases();
  const items = getPhaseItems(phases);
  const state = engagement ? getStateForEngagement(engagement) : getState(selectedClient.id);
  const done = items.filter((i) => {
    const slice = state[i.id];
    const display = deriveChecklistDisplayStatus(i.id, i, slice, brSnapshot);
    return isChecklistStepSequentiallyComplete(display === 'completed' ? 'completed' : slice?.status ?? 'not-started', slice);
  }).length;

  return (
    <div className="surface p-4 sm:p-6">
      {!isClient && (
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="serif text-lg font-semibold text-foreground">Pre-Incorporation</h2>
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
              {done} of {items.length} complete
            </p>
          </div>
          <div className="w-48">
            <ProgressBar value={items.length ? (done / items.length) * 100 : 0} />
          </div>
        </div>
      )}
      {isClient && (
        <p className={cn('mb-3 text-xs tabular-nums text-text-tertiary')}>
          {done} of {items.length} complete
        </p>
      )}

      <ChecklistPhaseJourney
        phases={phases}
        variant={variant}
        readOnly={readOnly}
        clientEditable={clientEditable}
      />
    </div>
  );
}
