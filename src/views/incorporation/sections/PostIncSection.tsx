'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { getPostIncPhases, getPhaseItems } from '@/data/checklist';
import { ChecklistPhaseJourney } from '@/components/incorporation/ChecklistPhaseJourney';
import { ChecklistSectionHeader } from '@/components/incorporation/ChecklistSectionHeader';
import { isChecklistStepSequentiallyComplete } from '@/lib/checklist-step-gate';
import { cn } from '@/lib/utils';

interface PostIncSectionProps {
  readOnly?: boolean;
  clientEditable?: boolean;
  variant?: 'admin' | 'client';
}

export function PostIncSection({
  readOnly = false,
  clientEditable = false,
  variant = 'admin',
}: PostIncSectionProps) {
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

  const state = useMemo(
    () =>
      selectedClient
        ? engagement
          ? getStateForEngagement(engagement)
          : getState(selectedClient.id)
        : {},
    [selectedClient, engagement, getState, getStateForEngagement],
  );
  const incorporationDate = useMemo<string | null>(
    () =>
      selectedClient?.incorporationDate?.trim() ||
      (state['pre-12']?.responses?.dateOfIncorporation?.trim() ?? null),
    [selectedClient?.incorporationDate, state],
  );

  if (!selectedClient) return null;

  const phases = getPostIncPhases();
  const items = getPhaseItems(phases);
  const done = items.filter((i) =>
    isChecklistStepSequentiallyComplete(state[i.id]?.status ?? 'not-started', state[i.id]),
  ).length;

  return (
    <div className="surface p-4 sm:p-6">
      <ChecklistSectionHeader
        title="Post-Incorporation"
        done={done}
        total={items.length}
        completeLabel="compliances complete"
        variant={variant}
      />

      {!incorporationDate && (
        <div
          className={cn(
            'mb-4 rounded-md border p-3 text-xs',
            isClient
              ? 'border-primary/25 bg-primary/5 text-paper'
              : 'border-warning/30 bg-warning-light text-warning-text',
          )}
        >
          {isClient
            ? 'Once your company is incorporated, statutory deadlines for post-incorporation filings will appear here.'
            : 'Add the incorporation date to activate statutory countdowns for post-incorporation filings.'}
        </div>
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
