import type { ChecklistField } from '@/data/checklist';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import { computeMcaNameApprovalExpiryDate } from '@/lib/checklist-responses';
import { applyPre1EngagementDefaults } from '@/lib/checklist-pre1-validation';
import { applyPre6PrefillFromPre1 } from '@/lib/pre6-prefill-from-pre1';
import { mergeRegisteredOfficeIntoPre6 } from '@/lib/registered-office-responses';
import type { Engagement } from '@/data/engagements';
import { validatePre1Responses } from '@/lib/checklist-pre1-validation';
import { validatePre6Responses } from '@/lib/checklist-pre6-validation';
import { validatePre7Responses } from '@/lib/checklist-pre7-validation';
import { validatePre8Responses } from '@/lib/checklist-pre8-validation';
import { validatePre9Responses } from '@/lib/checklist-pre9-validation';
import { validatePre10Responses } from '@/lib/checklist-pre10-validation';
import { validatePre11Responses } from '@/lib/checklist-pre11-validation';
import { validatePre12Responses } from '@/lib/checklist-pre12-validation';
import { type SectionPendingItem } from '@/lib/milestone-section-completion';
import type { SetStateAction } from 'react';

export type StaffSaveStatus = 'idle' | 'saved' | 'error';
export const AUTO_SAVE_DEBOUNCE_MS = 600;

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export type MilestoneFormState = {
  draft: ChecklistItemResponses;
  saving: boolean;
  autoSaveStatus: AutoSaveStatus;
  staffSaveStatus: StaffSaveStatus;
  uploadingField: string | null;
  fieldErrors: Record<string, string>;
  fieldWarnings: Record<string, string>;
  submitting: boolean;
  delivering: boolean;
  peakEndMoment: 'submit' | null;
  optimisticUnlock: Record<string, boolean>;
};

export type MilestoneFormAction = {
  type: 'patch';
  key: keyof MilestoneFormState;
  value: SetStateAction<MilestoneFormState[keyof MilestoneFormState]>;
};

export function milestoneFormReducer(
  state: MilestoneFormState,
  action: MilestoneFormAction,
): MilestoneFormState {
  const prev = state[action.key];
  const next =
    typeof action.value === 'function'
      ? (action.value as (current: typeof prev) => typeof prev)(prev)
      : action.value;
  if (Object.is(prev, next)) return state;
  return { ...state, [action.key]: next };
}

export function staffSaveStatusLabel(
  status: StaffSaveStatus,
  hasChanges: boolean,
  saving: boolean,
): string | null {
  if (saving) return 'Saving…';
  if (status === 'error') return 'Save failed — try again';
  if (status === 'saved' && !hasChanges) return 'All changes saved';
  if (hasChanges) return 'Unsaved changes';
  return null;
}

export type InternSectionFooterAction = 'next' | 'submit';

/** Earlier intern section tabs: Next. Last tab (or no tabs): Submit. */
export function internSectionFooterAction(
  selectedSectionIndex: number,
  sectionCount: number,
): InternSectionFooterAction {
  if (sectionCount > 0 && selectedSectionIndex < sectionCount - 1) return 'next';
  return 'submit';
}

export function internSectionFooterLabel(
  action: InternSectionFooterAction,
): 'Next' | 'Submit' {
  return action === 'next' ? 'Next' : 'Submit';
}

/** Intern Save is only for pending debounce, in-flight persist, or a failed auto-save. */
export function internShowSaveButton(autoSaveStatus: AutoSaveStatus): boolean {
  return (
    autoSaveStatus === 'pending' ||
    autoSaveStatus === 'saving' ||
    autoSaveStatus === 'error'
  );
}

export function internAutoSaveHint(autoSaveStatus: AutoSaveStatus): string | null {
  if (autoSaveStatus === 'pending' || autoSaveStatus === 'saving') return 'Saving…';
  if (autoSaveStatus === 'saved') return 'Saved';
  if (autoSaveStatus === 'error') return "Couldn't save — retry";
  return null;
}

export const EMPTY_PENDING_ITEMS: SectionPendingItem[] = [];

export function getChangedPartial(
  fields: ChecklistField[],
  from: ChecklistItemResponses,
  baseline: ChecklistItemResponses,
): ChecklistItemResponses {
  const partial: ChecklistItemResponses = {};
  for (const f of fields) {
    const next = from[f.id] ?? '';
    const prev = baseline[f.id] ?? '';
    if (next !== prev) partial[f.id] = next;
  }
  return partial;
}

export function groupFieldsBySection(fields: ChecklistField[]): { section: string | null; fields: ChecklistField[] }[] {
  const groups: { section: string | null; fields: ChecklistField[] }[] = [];
  for (const field of fields) {
    const section = field.section ?? null;
    const last = groups[groups.length - 1];
    if (last && last.section === section) {
      last.fields.push(field);
    } else {
      groups.push({ section, fields: [field] });
    }
  }
  return groups;
}

/** Named intern section tabs; leading/trailing ungrouped fields fold into the nearest heading. */
export function internNamedSectionGroups(
  groups: { section: string | null; fields: ChecklistField[] }[],
): { section: string; fields: ChecklistField[] }[] {
  const named: { section: string; fields: ChecklistField[] }[] = [];
  for (const group of groups) {
    if (group.section) {
      named.push({ section: group.section, fields: [...group.fields] });
    }
  }
  if (named.length === 0) return [];

  const firstNamedIndex = groups.findIndex((group) => Boolean(group.section));
  const lastNamedIndex = groups.reduce(
    (found, group, index) => (group.section ? index : found),
    -1,
  );
  if (firstNamedIndex > 0) {
    const leading = groups.slice(0, firstNamedIndex).flatMap((group) => group.fields);
    named[0]!.fields = [...leading, ...named[0]!.fields];
  }
  if (lastNamedIndex >= 0 && lastNamedIndex < groups.length - 1) {
    const trailing = groups.slice(lastNamedIndex + 1).flatMap((group) => group.fields);
    named[named.length - 1]!.fields.push(...trailing);
  }
  return named;
}

export type MilestoneFormFieldLayout = 'short' | 'full';

const LONG_HELPER_CHARS = 120;
const ADDRESS_FIELD_RE = /address/i;

/** Paragraph-length helper copy should not sit in a half-width column. */
function hasLongHelperText(field: ChecklistField): boolean {
  const helper = field.helperText?.trim();
  if (!helper) return false;
  return helper.length > LONG_HELPER_CHARS || helper.includes('\n');
}

/**
 * Short controls (dates, selects, names, phones) pair on desktop.
 * Textareas, uploads, address blocks, and long-helper fields stay full width.
 */
export function getMilestoneFormFieldLayout(field: ChecklistField): MilestoneFormFieldLayout {
  if (field.layout === 'short' || field.layout === 'full') return field.layout;
  if (field.type === 'textarea' || field.type === 'file') return 'full';
  if (hasLongHelperText(field)) return 'full';
  if (field.type === 'text' && ADDRESS_FIELD_RE.test(`${field.id} ${field.label}`)) {
    return 'full';
  }
  return 'short';
}

export function isImageStoragePath(path: string): boolean {
  return /\.(png|jpe?g|webp|gif)$/i.test(path);
}

export function computeMilestoneDraftFromSaved(
  itemId: string,
  saved: ChecklistItemResponses,
  engagement: Engagement | undefined,
  pre1Responses: ChecklistItemResponses,
  pre8Responses: ChecklistItemResponses,
): ChecklistItemResponses {
  if (itemId === 'pre-1') {
    return applyPre1EngagementDefaults({ ...saved }, engagement);
  }
  if (itemId === 'pre-5') {
    return {
      ...saved,
      nameApprovalExpiryDate:
        saved.nameApprovalExpiryDate?.trim() ||
        computeMcaNameApprovalExpiryDate(saved.nameApprovalDate ?? ''),
    };
  }
  if (itemId === 'pre-6') {
    return applyPre6PrefillFromPre1(
      mergeRegisteredOfficeIntoPre6({ ...saved }, pre8Responses),
      pre1Responses,
    );
  }
  return { ...saved };
}

export function mergeSavedFileFieldsIntoDraft(
  prev: ChecklistItemResponses,
  saved: ChecklistItemResponses,
  fileFields: ChecklistField[],
): ChecklistItemResponses {
  let next = prev;
  for (const field of fileFields) {
    const savedVal = (saved[field.id] ?? '').trim();
    const draftVal = (prev[field.id] ?? '').trim();
    if (savedVal && savedVal !== draftVal) {
      if (next === prev) next = { ...prev };
      next[field.id] = savedVal;
    }
  }
  return next;
}

export function runStepValidation(
  itemId: string,
  isPre1: boolean,
  isPre6: boolean,
  pre1Draft: ChecklistItemResponses,
  draft: ChecklistItemResponses,
  pre1ResponsesForPre6: ChecklistItemResponses,
  pre1SubmittedForPre6: boolean,
): { ok: boolean; errors: Record<string, string>; warnings: Record<string, string> } {
  if (isPre1) return validatePre1Responses(pre1Draft);
  if (isPre6) {
    if (!pre1SubmittedForPre6) {
      return {
        ok: false,
        errors: {
          _pre1Gate:
            'Complete and submit Phase 1 Step 1 (proposed directors) before filling director KYC.',
        },
        warnings: {},
      };
    }
    return validatePre6Responses(draft, pre1ResponsesForPre6);
  }
  if (itemId === 'pre-7') return validatePre7Responses(draft);
  if (itemId === 'pre-8') return validatePre8Responses(draft);
  if (itemId === 'pre-9') return validatePre9Responses(draft);
  if (itemId === 'pre-10') return validatePre10Responses(draft);
  if (itemId === 'pre-11') return validatePre11Responses(draft);
  if (itemId === 'pre-12') return validatePre12Responses(draft);
  return { ok: true, errors: {}, warnings: {} };
}
