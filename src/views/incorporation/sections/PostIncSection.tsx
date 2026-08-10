'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { getPostIncPhases, getPostIncPhaseStep, getPhaseItems } from '@/data/checklist';
import { ChecklistMilestoneCard } from '@/components/incorporation/ChecklistMilestoneCard';
import { ChecklistSectionHeader } from '@/components/incorporation/ChecklistSectionHeader';
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

  const phases = getPostIncPhases();
  const items = getPhaseItems(phases);
  const done = items.filter((i) => state[i.id]?.status === 'completed').length;

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
              ? 'border-orange/25 bg-orange/5 text-paper'
              : 'border-warning/30 bg-warning-light text-warning-text',
          )}
        >
          {isClient
            ? 'Once your company is incorporated, statutory deadlines for post-incorporation filings will appear here.'
            : 'Add the incorporation date to activate statutory countdowns for post-incorporation filings.'}
        </div>
      )}

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
                const phaseStep = getPostIncPhaseStep(item.id)?.stepNumber ?? item.order;
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
                    notes={item.notes}
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
