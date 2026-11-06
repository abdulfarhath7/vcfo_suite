import { getItem, type ChecklistField } from '@/data/checklist';
import { coerceOwnershipType } from '@/data/engagements';
import { entryForField, FIELD_CATALOG } from '@/lib/ask/field-catalog';
import { checkFormat } from '@/lib/ask/data-router/formats';
import { maskIdentityValue } from '@/lib/ask/mask';
import type { JsonValue, RowCheck } from '@/lib/ask/changeset/types';
import { expandRepeatEntry, isRepeatField, repeatFieldId, showWhenMatches } from '@/lib/checklist/checklist-repeat';
import { fieldsForOwnership, getClientResponseFields, type ChecklistItemResponses } from '@/lib/checklist/checklist-responses';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { checklistGateViewerFrom, gateActiveCatalog, getStepGate } from '@/lib/checklist/checklist-step-gate';
import { validateStepAgainstState } from '@/lib/checklist/checklist-step-validation';
import { canRoleEditField, isClientOnlyField, MANAGER_APPROVAL_STEP_ID } from '@/lib/incorporation/pre-inc-direct-flow';

/**
 * The checks one checklist row goes through, when it is proposed, when it is edited and again at
 * the click: the same step gate, field ownership, conditions and step validators as the screen.
 * Reads only. A row that fails `gate`, `owner` or `condition` is held; a row that fails `format`,
 * `answer` or `validator` waits for an edit; `conflict`, `other_step` and `documents_differ` only ask for a
 * closer look, so the person may still accept the row.
 */
export interface ResponseTarget {
  engagementId: string;
  stepId: string;
  fieldId: string;
  group?: string;
  entryId?: string;
  /** The entry does not exist yet; saving the first row adds it. */
  newEntry?: boolean;
  /** A step only a manager may approve: the card goes to the manager. */
  needsManager?: boolean;
  /** `checklist.attachFile` only: the chat attachment to copy to the step. */
  attachmentId?: string;
}

type StepState = Record<string, ChecklistItemStateSlice | undefined>;

export interface RowEngagement {
  ownershipType?: unknown;
  parentEntityName?: string | null;
  parentEntityAddress?: string | null;
  parentEntityRegistrationNumber?: string | null;
}

/** The actions that fill a checklist field: a client's own pair, and the staff pair. */
const RESPONSE_ACTIONS = {
  client: { set: 'client-portal.setAnswer', attach: 'client-portal.attachFile' },
  staff: { set: 'checklist.setResponse', attach: 'checklist.attachFile' },
} as const;

export const responseActionsFor = (role: string) => (role === 'client' ? RESPONSE_ACTIONS.client : RESPONSE_ACTIONS.staff);

/** A typed answer a person may correct on the card; a file row can only be accepted or left. */
export function isEditableAnswer(action: string): boolean {
  return action === RESPONSE_ACTIONS.client.set || action === RESPONSE_ACTIONS.staff.set;
}

export function isFileRow(action: string): boolean {
  return action === RESPONSE_ACTIONS.client.attach || action === RESPONSE_ACTIONS.staff.attach;
}

const NOT_BLOCKING: ReadonlySet<string> = new Set(['conflict', 'other_step', 'documents_differ']);
const HOLDS: ReadonlySet<string> = new Set(['gate', 'owner', 'condition']);

export function rowCanApply(checks: readonly RowCheck[]): boolean {
  return checks.every((check) => check.ok || NOT_BLOCKING.has(check.rule));
}

export function heldReasonOf(checks: readonly RowCheck[]): string | null {
  return checks.find((check) => !check.ok && HOLDS.has(check.rule))?.message ?? null;
}

export function responseKey(target: Pick<ResponseTarget, 'fieldId' | 'group' | 'entryId'>): string {
  return target.group && target.entryId ? repeatFieldId(target.group, target.entryId, target.fieldId) : target.fieldId;
}

/** The field as the screen sees it; on a list, with its condition pointing at this entry. */
export function fieldOf(target: Pick<ResponseTarget, 'stepId' | 'fieldId' | 'group' | 'entryId'>): ChecklistField | null {
  const item = getItem(target.stepId);
  if (!item) return null;
  const fields = getClientResponseFields(item);
  if (!target.group || !target.entryId) return fields.find((field) => field.id === target.fieldId) ?? null;
  const group = fields.find((field) => field.id === target.group);
  if (!group || !isRepeatField(group)) return null;
  return expandRepeatEntry(group, target.entryId).find((field) => field.id === responseKey(target)) ?? null;
}

export function needsManagerApproval(stepId: string): boolean {
  return stepId === MANAGER_APPROVAL_STEP_ID;
}

function ownerMessage(stepId: string, key: string, role: string): string {
  if (role === 'client') return 'Your project lead fills this field.';
  return isClientOnlyField(stepId, key) ? 'The client fills this field.' : 'The project lead fills this field.';
}

/**
 * A client's own field, beyond the direct-flow rule: it is on the form for this kind of company, and
 * a file answer only ever comes from a file, so typed text can never point a file field at a path.
 */
function clientOwnsField(target: ResponseTarget, key: string, ownership: unknown, field: ChecklistField | null, isFile: boolean | null): boolean {
  const item = getItem(target.stepId);
  if (!item || !field || field.type === 'repeat' || (isFile !== null && (field.type === 'file') !== isFile)) return false;
  const root = key.split('.')[0];
  return fieldsForOwnership(item.id, getClientResponseFields(item), coerceOwnershipType(ownership)).some((f) => f.id === root);
}

/** A value already on the screen for the same fact, on another step. */
function otherStepValue(
  target: ResponseTarget,
  entryIndex: number | null,
  state: StepState,
): { stepTitle: string; value: string } | null {
  const here = entryForField(target.stepId, target.fieldId, target.group);
  if (!here) return null;
  const catalog = FIELD_CATALOG.find((entry) => entry.key === here.key);
  for (const use of catalog?.uses ?? []) {
    if (use.source !== 'checklist' || use.ref === target.stepId || use.repeat) continue;
    const field = use.field.includes('#') ? (entryIndex ? use.field.replace('#', String(entryIndex)) : null) : use.field;
    const value = field ? state[use.ref]?.responses?.[field]?.trim() : '';
    if (value) return { stepTitle: getItem(use.ref)?.title ?? use.ref, value };
  }
  return null;
}

export interface RowCheckResult {
  checks: RowCheck[];
  heldReason: string | null;
  oldValue: string;
  /** The value in the shape the screen stores. */
  value: string;
  sensitive: boolean;
}

export function checkResponseRow(input: {
  role: string;
  target: ResponseTarget;
  value: string;
  state: StepState;
  /** Answers of earlier rows on the same card, which release a condition or join a whole-step rule. */
  pending?: ChecklistItemResponses;
  engagement: RowEngagement;
  isFile?: boolean;
  /** Only asking whether this person could fill this place at all, with no value yet. */
  probe?: boolean;
}): RowCheckResult {
  const { role, target, state, engagement } = input;
  const key = responseKey(target);
  const entry = entryForField(target.stepId, target.fieldId, target.group);
  const sensitive = entry?.sensitivity === 'identity';
  const saved = state[target.stepId]?.responses ?? {};
  const responses: ChecklistItemResponses = { ...saved, ...input.pending };
  // A new entry counts as on the list, so the step's rules read it the way they will after saving.
  if (target.group && target.entryId && !(responses[target.group] ?? '').split(',').includes(target.entryId)) {
    responses[target.group] = [responses[target.group], target.entryId].filter(Boolean).join(',');
  }
  const oldValue = saved[key]?.trim() ?? '';
  const checks: RowCheck[] = [];

  let value = input.value.trim();
  if (!input.isFile) {
    if (!value) checks.push({ rule: 'answer', ok: false, message: 'This needs your answer.' });
    else if (entry) {
      const format = checkFormat(entry, value);
      value = format.value;
      checks.push({ rule: 'format', ok: format.ok, ...(format.message ? { message: format.message } : {}) });
    }
  }

  const gates = gateActiveCatalog(state, checklistGateViewerFrom('admin', role));
  const gate = getStepGate(gates, target.stepId);
  const title = getItem(target.stepId)?.title ?? target.stepId;
  if (gate.kind === 'locked') {
    checks.push({ rule: 'gate', ok: false, message: gate.blockedByTitle ? `Held: "${title}" opens after "${gate.blockedByTitle}".` : `Held: "${title}" is not open yet.` });
  } else if (gate.kind === 'done') {
    checks.push({ rule: 'gate', ok: false, message: `Held: "${title}" is finished. It has to be reopened first.` });
  } else if (gate.kind === 'waiting' && !target.needsManager) {
    checks.push({ rule: 'gate', ok: false, message: `Held: ${gate.message ?? `"${title}" is waiting on someone.`}` });
  } else {
    checks.push({ rule: 'gate', ok: true });
  }

  const field = fieldOf(target);
  const owner = canRoleEditField(role, target.stepId, key) && (role !== 'client' || clientOwnsField(target, key, engagement.ownershipType, field, input.probe ? null : Boolean(input.isFile)));
  checks.push({ rule: 'owner', ok: owner, ...(owner ? {} : { message: `Held: ${ownerMessage(target.stepId, key, role)}` }) });

  if (!field) checks.push({ rule: 'condition', ok: false, message: 'Held: this field is not on the step.' });
  else if (field.showWhen && !showWhenMatches(field.showWhen, responses[field.showWhen.field])) {
    const parent = fieldOf({ ...target, fieldId: field.showWhen.field.split('.').pop() ?? field.showWhen.field });
    const label = parent?.label ?? 'another answer';
    const answer = responses[field.showWhen.field]?.trim();
    checks.push({
      rule: 'condition',
      ok: false,
      message: answer ? `Held: this field does not apply while "${label}" is ${answer}.` : `Held until "${label}" is answered.`,
    });
  }

  if (value && !input.isFile && checks.every((check) => check.ok || check.rule !== 'format')) {
    const errors = validateStepAgainstState({
      itemId: target.stepId,
      responses: { ...responses, [key]: value },
      state,
      engagement: { ...engagement, ownershipType: coerceOwnershipType(engagement.ownershipType) },
    }).errors;
    if (errors[key]) checks.push({ rule: 'validator', ok: false, message: errors[key] });
    else checks.push({ rule: 'validator', ok: true });
  }

  if (oldValue && value && oldValue !== value) {
    checks.push({ rule: 'conflict', ok: false, message: 'A different value is already saved. Accepting replaces it.' });
  }
  // A client's form shows each step on its own, and another step may hold what is not theirs to read.
  if (value && !input.isFile && role !== 'client') {
    const position = target.group && target.entryId ? (saved[target.group] ?? '').split(',').indexOf(target.entryId) + 1 : null;
    const other = otherStepValue(target, position || null, state);
    if (other && other.value !== value) {
      checks.push({
        rule: 'other_step',
        ok: false,
        message: `"${other.stepTitle}" holds ${sensitive ? maskIdentityValue(other.value) : other.value}.`,
      });
    }
  }
  return { checks, heldReason: heldReasonOf(checks), oldValue, value, sensitive };
}

export function displayValue(value: JsonValue, sensitive: boolean, options?: ChecklistField['options']): string {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value);
  if (!text) return '';
  if (sensitive) return maskIdentityValue(text);
  return options?.find((option) => option.value === text)?.label ?? text;
}
