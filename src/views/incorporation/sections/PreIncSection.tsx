'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { getPreIncPhases, getPreIncPhaseStep, itemsByBucket } from '@/data/checklist';
import { StatusBadgeWithTimeline } from '@/components/incorporation/ChecklistExpectedTimeline';
import { FormPill } from '@/components/common/FormPill';
import { AssigneeAvatar } from '@/components/common/AssigneeAvatar';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ItemDetailSlideOver } from '../ItemDetailSlideOver';
import { MilestoneResponseForm } from '../MilestoneResponseForm';
import { MilestoneResponseRowSummary } from '../MilestoneResponseRowSummary';
import { cn } from '@/lib/utils';
import { extractItemResponses } from '@/lib/checklist-responses';
import { hasResponseFormFields, shouldShowStatutoryFormLabels } from '@/lib/checklist-field-access';
import { Phase1StepPanel } from '@/components/incorporation/Phase1StepPanel';
import { ResponsibleRoleBadge } from '@/components/incorporation/ResponsibleRoleBadge';
import { deriveChecklistDisplayStatus } from '@/lib/checklist-display-status';
import { useBoardResolutionProgress } from '@/lib/use-board-resolution-progress';

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
  const { selectedClient, getState, getStateForEngagement, engagements, teamMembers } = useApp();
  const isClient = variant === 'client';
  const [expandedId, setExpandedId] = useState<string | null>(null);
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

  const items = itemsByBucket('pre-inc');
  const phases = getPreIncPhases();
  const state = engagement ? getStateForEngagement(engagement) : getState(selectedClient.id);
  const done = items.filter(
    (i) =>
      deriveChecklistDisplayStatus(i.id, i, state[i.id], brSnapshot) === 'completed',
  ).length;

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
            <ProgressBar value={(done / items.length) * 100} />
          </div>
        </div>
      )}
      {isClient && (
        <p className="mb-3 text-xs tabular-nums text-text-tertiary">
          {done} of {items.length} complete
        </p>
      )}

      <div className="space-y-6">
        {phases.map((phase) => (
          <section
            key={phase.id}
            className={cn(
              'rounded-lg border p-4',
              isClient ? 'border-border bg-raised/20' : 'border-border bg-raised/20'
            )}
          >
            <div className="mb-3 space-y-0.5">
              <h3 className={cn('text-sm font-semibold', isClient ? 'text-ink' : 'text-foreground')}>
                {phase.title}
              </h3>
              {phase.subtitle && (
                <p className={cn('text-[11px]', isClient ? 'text-text-tertiary' : 'text-muted-foreground')}>
                  {phase.subtitle}
                </p>
              )}
            </div>
            <ol className={cn('relative space-y-3 border-l pl-6', isClient ? 'border-border' : 'border-border')}>
              {phase.items.map((item) => {
                const itState = state[item.id] || { status: 'not-started' as const };
                const displayStatus = deriveChecklistDisplayStatus(
                  item.id,
                  item,
                  itState,
                  brSnapshot,
                );
                const assignee = teamMembers.find((t) => t.id === itState.assigneeId);
                const isOpen = expandedId === item.id;
                const phaseStep = getPreIncPhaseStep(item.id)?.stepNumber ?? item.order;
                return (
                  <li key={item.id} className="relative">
                    <span
                      className={cn(
                        'absolute -left-[1.875rem] top-3 flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px] font-semibold',
                        displayStatus === 'completed'
                          ? 'border-success bg-success text-success-foreground'
                          : displayStatus === 'in-progress'
                          ? 'border-info bg-info-light text-info-text'
                          : displayStatus === 'awaiting-client'
                          ? 'border-warning bg-warning-light text-warning-text'
                          : 'border-border bg-panel text-muted-foreground'
                      )}
                    >
                      {phaseStep}
                    </span>
                    <div className={cn('rounded-md border p-3', isClient ? 'border-border bg-raised/30' : 'border-border bg-raised/20')}>
                      <button type="button"
                        onClick={() => setExpandedId(isOpen ? null : item.id)}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn('text-sm font-medium', isClient ? 'text-ink' : 'text-foreground')}>{item.title}</span>
                            <ResponsibleRoleBadge role={item.responsibleRole} />
                            {shouldShowStatutoryFormLabels(item, variant) &&
                              item.forms.map((f) => (
                                <FormPill key={f}>{f}</FormPill>
                              ))}
                          </div>
                          <MilestoneResponseRowSummary
                            item={item}
                            responses={extractItemResponses(item, itState)}
                            variant={variant}
                            showEmptyHint={clientEditable}
                          />
                        </div>
                        <StatusBadgeWithTimeline
                          status={displayStatus}
                          item={item}
                          timelineClassName={isClient ? 'text-text-tertiary' : 'text-muted-foreground'}
                        />
                        <AssigneeAvatar initials={assignee?.initials} name={assignee?.name} />
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform',
                            isOpen && 'rotate-180'
                          )}
                        />
                      </button>

                      {isOpen && (
                        <div className="mt-3 border-t border-border pt-3">
                          {['pre-2', 'pre-3', 'pre-4', 'pre-5', 'pre-7', 'pre-8', 'pre-9', 'pre-10', 'pre-11', 'pre-12'].includes(item.id) && (
                            <Phase1StepPanel
                              item={item}
                              engagement={engagement}
                              responses={extractItemResponses(item, itState)}
                              variant={variant}
                              className="mb-4"
                            />
                          )}
                          {selectedClient &&
                            (clientEditable || variant === 'admin') &&
                            hasResponseFormFields(item, variant) && (
                            <div>
                              <MilestoneResponseForm
                                item={item}
                                clientId={engagement?.id ?? selectedClient.id}
                                engagementId={engagement?.id}
                                variant={variant}
                              />
                            </div>
                          )}
                          <div className="mt-3">
                            <ItemDetailSlideOver
                              item={item}
                              readOnly={readOnly}
                              clientEditable={false}
                              variant={variant}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
