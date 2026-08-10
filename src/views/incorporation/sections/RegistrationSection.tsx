'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { getRegistrationPhases, getRegistrationPhaseStep, getPhaseItems } from '@/data/checklist';
import { ChecklistMilestoneCard } from '@/components/incorporation/ChecklistMilestoneCard';
import { ChecklistSectionHeader } from '@/components/incorporation/ChecklistSectionHeader';
import { cn } from '@/lib/utils';

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
  const { selectedClient, getState, getStateForEngagement, engagements, teamMembers } = useApp();
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

  const phases = getRegistrationPhases();
  const items = getPhaseItems(phases);
  const applicable = items.filter((i) => state[i.id]?.status !== 'not-applicable');
  const done = applicable.filter((i) => state[i.id]?.status === 'completed').length;

  return (
    <div className="surface p-4 sm:p-6">
      <ChecklistSectionHeader
        title="Registration"
        done={done}
        total={applicable.length}
        completeLabel="registrations complete"
        variant={variant}
      />

      <div className="space-y-4 sm:space-y-6">
        {phases.map((phase) => (
          <section
            key={phase.id}
            className={cn(
              'rounded-lg border p-3 sm:p-4',
              isClient ? 'border-border bg-raised/20' : 'border-border bg-raised/20',
            )}
          >
            <div className="mb-4 space-y-0.5">
              <h3 className={cn('text-sm font-semibold', isClient ? 'text-ink' : 'text-foreground')}>
                {phase.title}
              </h3>
              {phase.subtitle && (
                <p className={cn('text-[11px]', isClient ? 'text-text-tertiary' : 'text-muted-foreground')}>
                  {phase.subtitle}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {phase.items.map((item) => {
                const itState = state[item.id] || { status: 'not-started' as const };
                const assignee = teamMembers.find((t) => t.id === itState.assigneeId);
                const phaseStep = getRegistrationPhaseStep(item.id)?.stepNumber ?? item.order;
                return (
                  <ChecklistMilestoneCard
                    key={item.id}
                    item={item}
                    phaseStep={phaseStep}
                    itemState={itState}
                    assignee={assignee}
                    incorporationDate={incorporationDate}
                    readOnly={readOnly}
                    clientEditable={clientEditable}
                    variant={variant}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
