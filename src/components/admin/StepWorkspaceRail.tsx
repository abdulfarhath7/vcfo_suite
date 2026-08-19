'use client';

import { ChecklistInlineTimeline } from '@/components/incorporation/ChecklistExpectedTimeline';
import { ResponsibleRoleBadge } from '@/components/incorporation/ResponsibleRoleBadge';
import { ChecklistReviewActions } from '@/components/admin/ChecklistReviewActions';
import { RequestManagerApproval } from '@/components/admin/RequestManagerApproval';
import { StatusDot } from '@/components/noir';
import { Button } from '@/components/ui/button';
import { STATUS_LABEL, type ChecklistItem, type StatusCode } from '@/data/checklist';
import type { ActivityEvent } from '@/data/engagements';
import { filterFieldsByViewer } from '@/lib/checklist-field-access';
import {
  getInternReviewLabel,
  isAwaitingReview,
  isReviewAccepted,
} from '@/lib/checklist-item-review';
import { getClientResponseFields, type ChecklistItemResponses } from '@/lib/checklist-responses';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import type { ChecklistStepGate } from '@/lib/checklist-step-gate';
import { fileNameFromStoragePath } from '@/lib/milestone-document-storage';
import { cn } from '@/lib/utils';

const STATUS_TONE_DOT: Record<
  StatusCode,
  'gold' | 'success' | 'warning' | 'danger' | 'info' | 'muted'
> = {
  'not-started': 'muted',
  'in-progress': 'info',
  'awaiting-client': 'warning',
  completed: 'success',
  overdue: 'danger',
  'not-applicable': 'muted',
};

export type StepWorkspaceRailProps = {
  item: ChecklistItem;
  status: StatusCode;
  statusCls: string;
  engagementId: string;
  itemState?: ChecklistItemStateSlice;
  responses?: ChecklistItemResponses;
  activity: ActivityEvent[];
  stepGate?: ChecklistStepGate;
  theme?: 'light' | 'dark';
  showLegacyChecklist?: boolean;
  hideTimeline?: boolean;
  /** Intern/lead: hide StatusDot + Completed / In progress words. */
  hideStatus?: boolean;
  totalsPct?: number;
  onMarkAll?: () => void;
  className?: string;
};

function nextActionCopy(
  item: ChecklistItem,
  itemState: ChecklistItemStateSlice | undefined,
  stepGate: ChecklistStepGate | undefined,
  hideTimeline?: boolean,
): string | null {
  if (stepGate?.kind === 'waiting' && stepGate.message) return stepGate.message;
  if (isAwaitingReview(itemState)) {
    return getInternReviewLabel(itemState) ?? 'Awaiting project manager approval.';
  }
  if (isReviewAccepted(itemState)) {
    return 'Approved. Deliver to the client when the files are ready.';
  }
  if (!hideTimeline && item.expectedTimeline) {
    return `Typical turnaround ${item.expectedTimeline}.`;
  }
  return null;
}

function AttachmentSummary({
  item,
  responses,
}: {
  item: ChecklistItem;
  responses?: ChecklistItemResponses;
}) {
  const files = filterFieldsByViewer(getClientResponseFields(item), 'admin').filter(
    (field) => field.type === 'file',
  );
  if (files.length === 0) return null;

  return (
    <section>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Attachments
      </p>
      <ul className="mt-2 space-y-1.5">
        {files.map((field) => {
          const path = responses?.[field.id]?.trim();
          return (
            <li key={field.id} className="text-[12px] leading-snug">
              <span className="text-foreground/90">{field.label}</span>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                {path ? fileNameFromStoragePath(path) : 'Not uploaded'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RecentActivity({ activity }: { activity: ActivityEvent[] }) {
  if (activity.length === 0) return null;
  const recent = activity.slice(0, 4);

  return (
    <section>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Activity
      </p>
      <ul className="mt-2 space-y-2">
        {recent.map((event) => (
          <li key={event.id} className="border-l border-border/80 pl-2.5 text-[12px] leading-snug">
            <span className="text-foreground">{event.actor}</span>{' '}
            <span className="text-muted-foreground">{event.verb}</span>
            {event.target ? (
              <>
                {' '}
                <span className="text-primary">{event.target}</span>
              </>
            ) : null}
            {event.at ? (
              <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {event.at}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Sticky complementary column for the staff checklist step workspace. */
export function StepWorkspaceRail({
  item,
  status,
  statusCls,
  engagementId,
  itemState,
  responses,
  activity,
  stepGate,
  theme = 'light',
  showLegacyChecklist = false,
  hideTimeline = false,
  hideStatus = false,
  totalsPct = 0,
  onMarkAll,
  className,
}: StepWorkspaceRailProps) {
  const next = nextActionCopy(item, itemState, stepGate, hideTimeline);
  const help = [item.description, item.notes].filter(Boolean).join(' ');

  return (
    <aside
      className={cn(
        'rounded-2xl border border-border/70 bg-background px-4 py-4',
        className,
      )}
    >
      <div className="space-y-4">
        <section>
          {!hideStatus ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                Status
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusDot tone={STATUS_TONE_DOT[status]} size={8} pulse={status === 'in-progress'} />
                <span className={cn('text-[11px] font-medium uppercase tracking-[0.12em]', statusCls)}>
                  {STATUS_LABEL[status]}
                </span>
              </div>
            </>
          ) : null}
          <div className={cn('flex flex-wrap items-center gap-2', !hideStatus && 'mt-2')}>
            <ResponsibleRoleBadge role={item.responsibleRole} />
            {!hideTimeline && (
              <ChecklistInlineTimeline item={item} className="text-muted-foreground" />
            )}
          </div>
        </section>

        {next ? (
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Next
            </p>
            <p className="mt-1.5 text-[12.5px] leading-snug text-foreground/90">{next}</p>
          </section>
        ) : null}

        <RequestManagerApproval
          engagementId={engagementId}
          itemId={item.id}
          itemState={itemState}
          emphasis="primary"
          className="hidden lg:block"
        />

        <ChecklistReviewActions
          engagementId={engagementId}
          itemId={item.id}
          itemState={itemState}
          theme={theme}
          className="!px-3 !py-3"
        />

        {showLegacyChecklist && onMarkAll ? (
          <Button
            type="button"
            size="sm"
            className="w-full cursor-pointer"
            onClick={onMarkAll}
            disabled={totalsPct === 100}
          >
            Mark all complete
          </Button>
        ) : null}

        <AttachmentSummary item={item} responses={responses} />

        {help ? (
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Help
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{help}</p>
          </section>
        ) : null}

        <RecentActivity activity={activity} />
      </div>
    </aside>
  );
}
