'use client';

import { ResponsibleRoleBadge } from '@/components/incorporation/ResponsibleRoleBadge';
import { ChecklistReviewActions } from '@/components/admin/ChecklistReviewActions';
import { RequestManagerApproval } from '@/components/admin/RequestManagerApproval';
import { RequestClientFill } from '@/components/admin/RequestClientFill';
import { Button } from '@/components/ui/button';
import type { ChecklistItem, StatusCode } from '@/data/checklist';
import type { ActivityEvent } from '@/data/engagements';
import { filterFieldsByViewer } from '@/lib/checklist/checklist-field-access';
import {
  getInternReviewLabel,
  isAwaitingReview,
  isReviewAccepted,
} from '@/lib/checklist/checklist-item-review';
import { getClientResponseFields, type ChecklistItemResponses } from '@/lib/checklist/checklist-responses';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import type { ChecklistStepGate } from '@/lib/checklist/checklist-step-gate';
import { fileNameFromStoragePath } from '@/lib/documents/milestone-document-storage';
import { cn } from '@/lib/utils';
import { withoutUnusedDirectorSlots } from '@/lib/incorporation/incorp-director-slots';
import { isDirectFlowStep } from '@/lib/incorporation/pre-inc-direct-flow';
import { StatusPill } from '@/components/common/StatusPill';

export type StepWorkspaceRailProps = {
  item: ChecklistItem;
  status: StatusCode;
  /** Kept for callers; the status now shows as the shared Spectrum chip. */
  statusCls: string;
  engagementId: string;
  itemState?: ChecklistItemStateSlice;
  responses?: ChecklistItemResponses;
  activity: ActivityEvent[];
  stepGate?: ChecklistStepGate;
  theme?: 'light' | 'dark';
  showLegacyChecklist?: boolean;
  /** Intern/lead: hide StatusDot + Completed / In progress words. */
  hideStatus?: boolean;
  totalsPct?: number;
  onMarkAll?: () => void;
  className?: string;
};

function nextActionCopy(
  itemId: string,
  itemState: ChecklistItemStateSlice | undefined,
  stepGate: ChecklistStepGate | undefined,
): string | null {
  if (stepGate?.kind === 'waiting' && stepGate.message) return stepGate.message;
  // Direct flow: no approval and no delivery — Submit is the whole story.
  if (isDirectFlowStep(itemId)) return null;
  if (isAwaitingReview(itemState)) {
    return getInternReviewLabel(itemState) ?? 'Awaiting project manager approval.';
  }
  if (isReviewAccepted(itemState)) {
    return 'Approved. Deliver to the client when the files are ready.';
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
  const files = withoutUnusedDirectorSlots(
    item.id,
    filterFieldsByViewer(getClientResponseFields(item), 'admin'),
    responses,
  ).filter(
    (field) => field.type === 'file',
  );
  if (files.length === 0) return null;

  return (
    <section>
      <p className="text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted">
        Attachments
      </p>
      <ul className="mt-2 space-y-1.5">
        {files.map((field) => {
          const path = responses?.[field.id]?.trim();
          return (
            <li key={field.id} className="text-[13px] leading-snug">
              <span className="text-ink">{field.label}</span>
              <span className="mt-0.5 block truncate text-[12px] text-ink-muted">
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
      <p className="text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted">
        Activity
      </p>
      <ul className="mt-2 space-y-2">
        {recent.map((event) => (
          <li key={event.id} className="border-l-1.5 border-line pl-2.5 text-[13px] leading-snug">
            <span className="text-ink">{event.actor}</span>{' '}
            <span className="text-ink-muted">{event.verb}</span>
            {event.target ? (
              <>
                {' '}
                <span className="text-brand-text">{event.target}</span>
              </>
            ) : null}
            {event.at ? (
              <span className="mt-0.5 block text-[12px] text-ink-muted">
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
  engagementId,
  itemState,
  responses,
  activity,
  stepGate,
  theme = 'light',
  showLegacyChecklist = false,
  hideStatus = false,
  totalsPct = 0,
  onMarkAll,
  className,
}: StepWorkspaceRailProps) {
  const next = nextActionCopy(item.id, itemState, stepGate);

  return (
    <aside
      className={cn(
        'rounded-md border-1.5 border-line bg-surface-raised px-4 py-4',
        className,
      )}
    >
      <div className="space-y-4">
        <section>
          {!hideStatus ? (
            <>
              <p className="text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted">
                Status
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusPill status={status} />
              </div>
            </>
          ) : null}
          <div className={cn('flex flex-wrap items-center gap-2', !hideStatus && 'mt-2')}>
            <ResponsibleRoleBadge role={item.responsibleRole} />
          </div>
        </section>

        {next ? (
          <section>
            <p className="text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted">
              Next
            </p>
            <p className="mt-1.5 text-[13px] leading-snug text-ink">{next}</p>
          </section>
        ) : null}

        <RequestManagerApproval
          engagementId={engagementId}
          itemId={item.id}
          itemState={itemState}
          emphasis="primary"
          className="hidden lg:block"
        />

        <RequestClientFill
          engagementId={engagementId}
          itemId={item.id}
          itemState={itemState}
          emphasis="primary"
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

        <RecentActivity activity={activity} />
      </div>
    </aside>
  );
}
