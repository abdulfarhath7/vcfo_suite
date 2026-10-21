/**
 * Pure helpers and constants shared by the milestone response form hooks and
 * renderers. `useMilestoneResponseFormState` composes the pieces in this folder.
 */
import type { ChecklistField } from '@/data/checklist';
import type { ChecklistItemResponses } from '@/lib/checklist/checklist-responses';
import { ADDITIONAL_NIC_CODES_GROUP_ID } from '@/lib/incorporation/nic-2008';

/** True when an error key belongs to one of these fields (repeat ids are dotted under the group). */
export function errorKeyInFields(key: string, fields: readonly ChecklistField[]): boolean {
  return fields.some((field) => key === field.id || key.startsWith(`${field.id}.`));
}

export function fieldErrorId(itemId: string, fieldId: string): string {
  return `${itemId}-${fieldId}-error`;
}

/** `additionalNicCodes.<entry>` for a field inside a NIC repeat entry, else null. */
export function additionalNicCodeEntryOf(fieldId: string): string | null {
  const [group, entryId] = fieldId.split('.');
  return group === ADDITIONAL_NIC_CODES_GROUP_ID && entryId ? `${group}.${entryId}` : null;
}

export function isNicCodeInput(itemId: string, fieldId: string): boolean {
  if (itemId !== 'pre-1') return false;
  return fieldId === 'nicCode' || (additionalNicCodeEntryOf(fieldId) !== null && fieldId.endsWith('.code'));
}

/** The user's edits this session: full values plus which fields they touched. */
export interface DraftEdits {
  values: ChecklistItemResponses;
  touched: ReadonlySet<string>;
}
export const NO_FIELDS: ReadonlySet<string> = new Set();

export const PHASE2_STRUCTURED_STEP_IDS = new Set([
  'pre-6',
  'pre-13',
  'pre-14',
  'pre-15',
  'pre-16',
  'pre-7',
  'pre-8',
  'pre-9',
  'pre-10',
  'pre-11',
  'pre-12',
]);
