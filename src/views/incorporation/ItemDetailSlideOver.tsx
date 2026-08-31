'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ChecklistItem, StatusCode, STATUS_LABEL } from '@/data/checklist';
import { computeDueDate, formatDate } from '@/lib/deadlines';
import { ChecklistStatusBadge } from '@/components/incorporation/ChecklistStatusBadge';
import { RegistrationWorkflowControls } from '@/components/incorporation/RegistrationWorkflowControls';
import { FormPill } from '@/components/common/FormPill';
import { CountdownChip } from '@/components/common/CountdownChip';
import { AssigneeAvatar } from '@/components/common/AssigneeAvatar';
import { SlideOver } from '@/components/common/SlideOver';
import { MilestoneResponseForm } from './MilestoneResponseForm';
import { shouldShowStatutoryFormLabels } from '@/lib/checklist-field-access';
import type { RegistrationWorkflowStage } from '@/lib/registration-workflow';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type TriggerVariant = 'primary' | 'secondary' | 'link';

interface Props {
  item: ChecklistItem;
  readOnly?: boolean;
  clientEditable?: boolean;
  variant?: 'admin' | 'client';
  triggerVariant?: TriggerVariant;
  triggerLabel?: string;
  showSecondaryTrigger?: boolean;
  secondaryLabel?: string;
}

const triggerStyles: Record<TriggerVariant, string> = {
  primary:
    'inline-flex min-h-[44px] items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:min-h-0 sm:py-1.5 sm:px-2.5',
  secondary:
    'inline-flex min-h-[44px] items-center justify-center rounded-md border border-border bg-transparent px-3 py-2 text-xs font-medium text-text-secondary hover:bg-raised/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:min-h-0 sm:py-1.5 sm:px-2.5',
  link: 'inline-flex min-h-[44px] items-center gap-0.5 text-xs font-medium text-primary-dark hover:text-primary sm:min-h-0',
};

export function ItemDetailSlideOver({
  item,
  readOnly = false,
  clientEditable = false,
  variant = 'admin',
  triggerVariant = 'link',
  triggerLabel,
  showSecondaryTrigger = false,
  secondaryLabel = 'Add details',
}: Props) {
  const { selectedClient, getState, updateItem, teamMembers } = useApp();
  const [open, setOpen] = useState(false);

  if (!selectedClient) return null;
  const state = getState(selectedClient.id)[item.id] || { status: 'not-started' as StatusCode };
  const assignee = teamMembers.find((t) => t.id === state.assigneeId);
  const due = computeDueDate(
    item.deadline,
    selectedClient.incorporationDate ? new Date(selectedClient.incorporationDate) : null
  );
  const primaryLabel = triggerLabel ?? (readOnly ? 'View milestone' : 'Open item');
  const showSecondary = showSecondaryTrigger && clientEditable;

  return (
    <>
      <div className="inline-flex items-center gap-2 w-full sm:w-auto">
        {showSecondary && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(triggerStyles.secondary, 'flex-1 sm:flex-none')}
          >
            {secondaryLabel}
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(triggerStyles[triggerVariant], 'flex-1 sm:flex-none')}
        >
          {primaryLabel}
          {triggerVariant === 'primary' && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
          {triggerVariant === 'link' && <span aria-hidden>→</span>}
        </button>
      </div>
      <SlideOver
        open={open}
        onOpenChange={setOpen}
        title={item.title}
        description={item.description}
      >
        <div className="space-y-5">
          {shouldShowStatutoryFormLabels(item, variant) && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                Forms
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {item.forms.map((f) => (
                  <FormPill key={f}>{f}</FormPill>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Block label="Status" variant={variant}>
              {readOnly ? (
                <div className="mt-1">
                  <ChecklistStatusBadge status={state.status} />
                </div>
              ) : (
                <select
                  value={state.status}
                  onChange={(e) =>
                    updateItem(selectedClient.id, item.id, {
                      status: e.target.value as StatusCode,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-border bg-panel px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              )}
            </Block>
            <Block label={readOnly ? 'VCFO lead' : 'Assignee'} variant={variant}>
              {readOnly ? (
                <div className="mt-1 flex items-center gap-2 text-xs text-foreground">
                  <AssigneeAvatar initials={assignee?.initials} name={assignee?.name} />
                  {assignee?.name || 'Assigned by your team'}
                </div>
              ) : (
                <select
                  value={state.assigneeId || ''}
                  onChange={(e) =>
                    updateItem(selectedClient.id, item.id, {
                      assigneeId: e.target.value || undefined,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-border bg-panel px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">No assignee</option>
                  {teamMembers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </Block>
            <Block label="Due date" variant={variant}>
              <div className="mt-1 text-xs text-foreground">{due ? formatDate(due) : '—'}</div>
            </Block>
            {!readOnly && (
              <Block label="Assigned to" variant={variant}>
                <div className="mt-1 flex items-center gap-2 text-xs text-foreground">
                  <AssigneeAvatar initials={assignee?.initials} name={assignee?.name} />
                  {assignee?.name || 'Not assigned'}
                </div>
              </Block>
            )}
          </div>

          {item.bucket === 'statutory' && (
            <RegistrationWorkflowControls
              status={state.status}
              workflowStage={state.workflowStage}
              readOnly={readOnly}
              onStatusChange={(next) =>
                updateItem(selectedClient.id, item.id, { status: next })
              }
              onWorkflowStageChange={(stage: RegistrationWorkflowStage) =>
                updateItem(selectedClient.id, item.id, {
                  workflowStage: stage,
                  ...(state.status === 'not-started' || state.status === 'not-applicable'
                    ? { status: 'in-progress' as StatusCode }
                    : {}),
                })
              }
            />
          )}

          {clientEditable && state.status !== 'not-applicable' && (
            <MilestoneResponseForm
              item={item}
              clientId={selectedClient.id}
              variant={variant}
            />
          )}

          {item.notes && (
            <div className="rounded-md bg-warning-light p-3 text-xs text-warning-text">
              <span className="font-semibold">Note: </span>
              {item.notes}
            </div>
          )}

          {!readOnly && (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                Internal notes
              </div>
              <textarea
                rows={3}
                defaultValue={state.notes || ''}
                onBlur={(e) =>
                  updateItem(selectedClient.id, item.id, { notes: e.target.value })
                }
                aria-label="Internal notes"
                placeholder="Internal note for your compliance team…"
                className="w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          {due && <CountdownChip rule={item.deadline} incorporationDate={selectedClient.incorporationDate} />}
        </div>
      </SlideOver>
    </>
  );
}

function Block({
  label,
  children,
  variant = 'admin',
}: {
  label: string;
  children: React.ReactNode;
  variant?: 'admin' | 'client';
}) {
  return (
    <div>
      <div
        className={cn(
          'text-[11px] font-semibold uppercase tracking-wide text-text-tertiary',
        )}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
