import { getItem, type ChecklistField } from '@/data/checklist';
import { coerceOwnershipType, type OwnershipType } from '@/data/engagements';
import { expandRepeatEntry, isRepeatField } from '@/lib/checklist/checklist-repeat';
import { getClientResponseFields } from '@/lib/checklist/checklist-responses';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { validateStepAgainstState } from '@/lib/checklist/checklist-step-validation';
import { isDirectFlowStep } from '@/lib/incorporation/pre-inc-direct-flow';

/**
 * How much of a step's required answers are saved, read through the step's own validator
 * (`validateStepAgainstState`, the one the form and the submit run), so a green tick means Submit
 * would pass on what is saved. Pure and browser-safe: the step rail, the fill rail and the fill's
 * chat summary all read this one answer.
 *
 * Only direct-flow steps have rules to read; every other step returns null (no mark).
 */
export interface StepCompleteness {
  complete: boolean;
  /** Distinct answers still needed. */
  missing: number;
  /** The needed answers' labels, in the order the validator found them. */
  labels: string[];
}

export interface CompletenessEngagement {
  ownershipType?: unknown;
  parentEntityName?: string | null;
  parentEntityAddress?: string | null;
  parentEntityRegistrationNumber?: string | null;
}

type StepState = Record<string, ChecklistItemStateSlice | undefined>;

function fieldLabel(fields: readonly ChecklistField[], key: string): string | null {
  // Workflow keys (`_pre1Gate`) are a rule, not an answer the person can type.
  if (key.startsWith('_')) return null;
  const [groupId, entryId, fieldId] = key.split('.');
  const direct = fields.find((field) => field.id === key);
  if (direct) return direct.label;
  if (groupId && entryId && fieldId) {
    const group = fields.find((field) => field.id === groupId);
    if (group && isRepeatField(group)) {
      const entryField = expandRepeatEntry(group, entryId).find((field) => field.id === key);
      return entryField?.label ?? group.label;
    }
  }
  if (groupId) {
    const group = fields.find((field) => field.id === groupId);
    if (group) return group.label;
  }
  return key;
}

export function stepCompleteness(input: { stepId: string; state: StepState; engagement?: CompletenessEngagement | null }): StepCompleteness | null {
  const item = getItem(input.stepId);
  if (!item || !isDirectFlowStep(input.stepId)) return null;
  const engagement = input.engagement ?? null;
  const ownershipType: OwnershipType = coerceOwnershipType(engagement?.ownershipType);
  const { errors } = validateStepAgainstState({
    itemId: input.stepId,
    responses: input.state[input.stepId]?.responses ?? {},
    state: input.state as Parameters<typeof validateStepAgainstState>[0]['state'],
    engagement: { ...engagement, ownershipType },
  });
  const fields = getClientResponseFields(item);
  const labels: string[] = [];
  for (const key of Object.keys(errors)) {
    const label = fieldLabel(fields, key);
    if (label && !labels.includes(label)) labels.push(label);
  }
  const blocked = Object.keys(errors).length > 0;
  const missing = blocked ? Math.max(labels.length, 1) : 0;
  return { complete: !blocked, missing, labels };
}

/** "3 to fill" / "Ready to submit", for a tooltip or a screen reader. */
export function completenessLabel(mark: Pick<StepCompleteness, 'complete' | 'missing'>): string {
  return mark.complete ? 'All required answers filled' : `${mark.missing} to fill`;
}
