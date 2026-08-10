'use client';

import type { ChecklistItem } from '@/data/checklist';
import type { StatusCode } from '@/data/checklist';
import { teamMembers } from '@/data/mockData';
import { StatusBadgeWithTimeline } from '@/components/incorporation/ChecklistExpectedTimeline';
import { ResponsibleRoleBadge } from '@/components/incorporation/ResponsibleRoleBadge';
import { FormPill } from '@/components/common/FormPill';
import { CountdownChip } from '@/components/common/CountdownChip';
import { AssigneeAvatar } from '@/components/common/AssigneeAvatar';
import { ItemDetailSlideOver } from '@/views/incorporation/ItemDetailSlideOver';
import { MilestoneResponseRowSummary } from '@/views/incorporation/MilestoneResponseRowSummary';
import { extractItemResponses, formatResponseSummary } from '@/lib/checklist-responses';
import { shouldShowStatutoryFormLabels } from '@/lib/checklist-field-access';
import { computeDueDate } from '@/lib/deadlines';
import {
  registrationWorkflowShortLabel,
  type RegistrationWorkflowStage,
} from '@/lib/registration-workflow';
import { cn } from '@/lib/utils';

interface ItemStateSlice {
  status: StatusCode;
  assigneeId?: string;
  responses?: Record<string, unknown>;
  workflowStage?: RegistrationWorkflowStage;
}

export interface ChecklistMilestoneCardProps {
  item: ChecklistItem;
  phaseStep: number;
  itemState: ItemStateSlice;
  assignee?: (typeof teamMembers)[number];
  incorporationDate: string | null;
  readOnly?: boolean;
  clientEditable?: boolean;
  variant?: 'admin' | 'client';
  notes?: string;
}

export function ChecklistMilestoneCard({
  item,
  phaseStep,
  itemState,
  assignee,
  incorporationDate,
  readOnly = false,
  clientEditable = false,
  variant = 'admin',
  notes,
}: ChecklistMilestoneCardProps) {
  const isClient = variant === 'client';
  const isNa = itemState.status === 'not-applicable';
  const responses = extractItemResponses(item, itemState as { responses?: Record<string, unknown> });
  const { hasAny } = formatResponseSummary(item, responses);
  const incDate = incorporationDate ? new Date(incorporationDate) : null;
  const hasActiveCountdown = Boolean(incDate && computeDueDate(item.deadline, incDate) && !isNa);
  const showAssignee = Boolean(assignee?.initials);
  const showFormLabels = shouldShowStatutoryFormLabels(item, variant);
  const workflowLabel =
    item.bucket === 'statutory' && itemState.workflowStage && !isNa
      ? registrationWorkflowShortLabel(itemState.workflowStage)
      : null;

  return (
    <article
      className={cn(
        'surface flex h-full flex-col p-4',
        isClient && 'bg-raised/30',
        item.urgent && !isNa && 'border-warning/50 bg-warning-light/30',
        isNa && 'opacity-60',
      )}
    >
      <div className="mb-2 flex items-start gap-2">
        <p
          className={cn(
            'min-w-0 flex-1 text-sm font-medium leading-snug line-clamp-2',
            isClient ? 'text-ink' : 'text-foreground',
          )}
          title={item.title}
        >
          <span className="mr-1.5 font-mono text-[10px] font-normal text-text-tertiary tabular-nums">
            {phaseStep}.
          </span>
          {item.title}
        </p>
        {item.urgent && !isNa && (
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-text bg-warning-light">
            Urgent
          </span>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusBadgeWithTimeline status={itemState.status} item={item} />
        <ResponsibleRoleBadge role={item.responsibleRole} />
        {workflowLabel && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-text-secondary">
            {workflowLabel}
          </span>
        )}
      </div>

      {notes && (
        <p className={cn('mb-2 text-[11px] leading-relaxed', isClient ? 'text-text-tertiary' : 'text-muted-foreground')}>
          {notes}
        </p>
      )}

      <MilestoneResponseRowSummary
        item={item}
        responses={responses}
        variant={variant}
        showEmptyHint={false}
        className="mb-2"
      />

      {((showFormLabels && item.forms.length > 0) || hasActiveCountdown) && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {showFormLabels && item.forms.map((f) => <FormPill key={f}>{f}</FormPill>)}
          {hasActiveCountdown && (
            <CountdownChip
              rule={item.deadline}
              incorporationDate={incorporationDate}
              onlyCountdown
            />
          )}
        </div>
      )}

      <div
        className={cn(
          'mt-auto flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between',
          isClient ? 'border-border/60' : 'border-border',
        )}
      >
        <div className="min-w-0">
          {showAssignee ? (
            <div className="flex items-center gap-1.5">
              <AssigneeAvatar initials={assignee?.initials} name={assignee?.name} />
              {assignee?.name && (
                <span className={cn('truncate text-[11px]', isClient ? 'text-text-tertiary' : 'text-muted-foreground')}>
                  {assignee.name}
                </span>
              )}
            </div>
          ) : (
            <span className={cn('text-[11px]', isClient ? 'text-text-tertiary/70' : 'text-text-tertiary')}>
              Assigned by your team
            </span>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <ItemDetailSlideOver
            item={item}
            readOnly={readOnly}
            clientEditable={clientEditable}
            variant={variant}
            triggerVariant="primary"
            showSecondaryTrigger={clientEditable && !hasAny}
          />
        </div>
      </div>
    </article>
  );
}
