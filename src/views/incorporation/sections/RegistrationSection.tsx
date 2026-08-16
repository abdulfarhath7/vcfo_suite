'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { getRegistrationPhases, getPhaseItems } from '@/data/checklist';
import { ChecklistPhaseJourney } from '@/components/incorporation/ChecklistPhaseJourney';
import { ChecklistSectionHeader } from '@/components/incorporation/ChecklistSectionHeader';
import { isChecklistStepSequentiallyComplete } from '@/lib/checklist-step-gate';

interface RegistrationSectionProps {
  readOnly?: boolean;
  clientEditable?: boolean;
  variant?: 'admin' | 'client';
}

export function RegistrationSection({
  readOnly = false,
  clientEditable = false,
  variant = 'admin',
}: RegistrationSectionProps) {
  const { selectedClient, getState, getStateForEngagement, engagements } = useApp();
  const engagement = useMemo(
    () =>
      selectedClient
        ? engagements.find(
            (e) => e.id === selectedClient.id || e.clientId === selectedClient.id,
          )
        : undefined,
    [engagements, selectedClient],
  );

  const state = useMemo(
    () =>
      selectedClient
        ? engagement
          ? getStateForEngagement(engagement)
          : getState(selectedClient.id)
        : {},
    [selectedClient, engagement, getState, getStateForEngagement],
  );

  if (!selectedClient) return null;

  const phases = getRegistrationPhases();
  const items = getPhaseItems(phases);
  const applicable = items.filter((i) => state[i.id]?.status !== 'not-applicable');
  const done = applicable.filter((i) =>
    isChecklistStepSequentiallyComplete(state[i.id]?.status ?? 'not-started', state[i.id]),
  ).length;

  return (
    <div className="surface p-4 sm:p-6">
      <ChecklistSectionHeader
        title="Registration"
        done={done}
        total={applicable.length}
        completeLabel="registrations complete"
        variant={variant}
      />

      <ChecklistPhaseJourney
        phases={phases}
        variant={variant}
        readOnly={readOnly}
        clientEditable={clientEditable}
      />
    </div>
  );
}
