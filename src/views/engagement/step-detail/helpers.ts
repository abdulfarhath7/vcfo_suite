import type { ChecklistItem } from '@/data/checklist';
import type { OwnershipType } from '@/data/engagements';
import { formatWindow, windowForStep, type EngagementSchedule } from '@/lib/projects/schedule-windows';
import { extractItemResponses } from '@/lib/checklist/checklist-responses';
import { getStepAttachmentRequirements } from '@/lib/checklist/checklist-step-attachments';
import type { JourneyRailItem } from '@/components/incorporation/ChecklistJourneyRail';
import { deriveChecklistDisplayStatus } from '@/lib/checklist/checklist-display-status';
import { gateDisplayStatus, getStepGate, type ChecklistStepGate } from '@/lib/checklist/checklist-step-gate';
import type { BoardResolutionProgressSnapshot } from '@/lib/client/client-progress-board';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { directFlowRoleLabel } from '@/lib/incorporation/pre-inc-direct-flow';
import { orderByMcaSection, partBStepDisplayLabel } from '@/lib/checklist/part-b-sections';
import { recordStepPlace } from '@/views/client-record/RecordHeadParts';
import { stepCompleteness, type CompletenessEngagement } from '@/lib/incorporation/step-completeness';
import { shownDoneGate } from '@/lib/incorporation/shown-step-gates';

/**
 * The lead's completeness marks (PLAN K): a step not finished yet that holds answers (or is the one
 * open now) shows a green tick when every required answer is saved, or a red dot with "N to fill".
 * Untouched later steps stay plain, so the rail does not fill with dots.
 */
function railCompleteness(
  stepId: string,
  gate: ChecklistStepGate,
  checklistState: Record<string, ChecklistItemStateSlice | undefined>,
  engagement: CompletenessEngagement,
) {
  if (gate.kind === 'done') return null;
  const responses = checklistState[stepId]?.responses ?? {};
  const started = Object.values(responses).some((value) => String(value ?? '').trim().length > 0);
  if (!started && gate.kind !== 'active') return null;
  return stepCompleteness({ stepId, state: checklistState, engagement });
}

/** "Last edited by Kiran Rao (Client), 12 Oct 2026, 4:05 pm" — IST, like every other time in the app. */
export function lastEditedLine(slice: ChecklistItemStateSlice | undefined): string | null {
  const at = slice?.lastEditedAt?.trim();
  if (!at) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  const when = date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
  const who = slice?.lastEditedByName?.trim() || 'Someone';
  return `Last edited by ${who} (${directFlowRoleLabel(slice?.lastEditedByRole)}), ${when}`;
}

export function journeyRailItems(
  steps: readonly ChecklistItem[],
  gates: Record<string, ChecklistStepGate>,
  checklistState: Record<string, ChecklistItemStateSlice | undefined>,
  brSnapshot: BoardResolutionProgressSnapshot | null | undefined,
  ownershipType: OwnershipType | undefined,
  schedule: EngagementSchedule | undefined,
  viewerIsClient: boolean,
  /** The lead's rail: the engagement the completeness marks read (company type, parent entity). */
  completenessFor?: CompletenessEngagement | null,
): JourneyRailItem[] {
  // SB-01: the rail lists Part B in MCA form order. The step number stays the
  // checklist position and the staff code turns into the MCA section, so no
  // number reads out of sequence. Opening and gating are unchanged.
  const numbered = steps.map((step, index) => ({ step, index }));
  return orderByMcaSection(numbered, (row) => row.step.id).map(({ step, index }) => {
    const slice = checklistState[step.id];
    const gated = getStepGate(gates, step.id);
    const status = gateDisplayStatus(deriveChecklistDisplayStatus(step.id, step, slice, brSnapshot ?? undefined), gated);
    // The node, the connector and the "x of y" count follow the status the step's head shows.
    const gate = shownDoneGate(gated, status);
    const window = windowForStep(schedule, step.id);
    const completeness = completenessFor ? railCompleteness(step.id, gate, checklistState, completenessFor) : null;
    return {
      ...(completeness ? { completeness } : {}),
      ...(window && viewerIsClient ? { windowLabel: formatWindow(window) } : {}),
      ...(!viewerIsClient ? { stepCode: partBStepDisplayLabel(step.id, recordStepPlace(step.id)?.code) } : {}),
      item: step,
      gate,
      status,
      stepNumber: index + 1,
      attachments: getStepAttachmentRequirements(
        step,
        extractItemResponses(step, slice),
        ownershipType,
      ),
    };
  });
}
