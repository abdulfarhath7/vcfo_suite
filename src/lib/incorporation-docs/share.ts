import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { incorpDocRowKey } from '@/lib/incorporation-docs/paths';
import type { IncorpDraftDocLink, IncorpDraftDocSlot } from '@/lib/incorporation-docs/paths';
import {
  incorpDraftDocLinksFromResponses,
  incorpDraftDocSlotsFromResponses,
  type IncorpDraftLabelOptions,
} from '@/lib/incorporation-docs/paths';
import { isIncorpDocAudience, type IncorpDocAudience } from '@/lib/incorporation-docs/audiences';
import {
  directorSignedFieldIdFor,
  INCORP_DOC_KINDS,
  type IncorpDocKind,
} from '@/lib/incorporation-docs/types';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';

/** Row keys (`doc:audience`) released to the client portal (Pre-8 downloads). */
function sharedIncorpDraftRowKeys(
  slice?: Pick<ChecklistItemStateSlice, 'sharedIncorpDraftDocs'>,
): string[] {
  if (!slice) return [];
  return Array.isArray(slice.sharedIncorpDraftDocs)
    ? slice.sharedIncorpDraftDocs.filter((k): k is string => typeof k === 'string' && k.includes(':'))
    : [];
}

export function isIncorpDraftRowKey(value: string): boolean {
  const [doc, audience] = value.split(':');
  const validDocs = new Set<string>(INCORP_DOC_KINDS);
  return validDocs.has(doc) && isIncorpDocAudience(audience ?? '');
}

/** All incorporation draft slots (director forms + company documents). */
export function incorpDraftSlotCount(slots: IncorpDraftDocSlot[]): number {
  return slots.length;
}

/** Every required slot holds a draft; optional slots never hold the share back. */
export function allIncorpDraftSlotsGenerated(slots: IncorpDraftDocSlot[]): boolean {
  const required = slots.filter((slot) => !slot.optional);
  return required.length > 0 && required.every((slot) => slot.path.trim().length > 0);
}

export function generatedIncorpDraftRowKeys(slots: IncorpDraftDocSlot[]): string[] {
  return slots.flatMap((slot) => {
    const path = slot.path.trim();
    return path ? [incorpDocRowKey(slot.doc, slot.audience)] : [];
  });
}

/** Client may download when the row was included in a bulk (or legacy per-doc) share. */
export function isIncorpDraftSharedWithClient(
  slice: ChecklistItemStateSlice | undefined,
  doc: IncorpDocKind,
  audience: IncorpDocAudience,
): boolean {
  const key = incorpDocRowKey(doc, audience);
  return sharedIncorpDraftRowKeys(slice).includes(key);
}

function areAllGeneratedIncorpDraftsShared(
  slots: IncorpDraftDocSlot[],
  slice?: Pick<ChecklistItemStateSlice, 'sharedIncorpDraftDocs'>,
): boolean {
  const generated = generatedIncorpDraftRowKeys(slots);
  if (generated.length === 0) return false;
  const shared = new Set(sharedIncorpDraftRowKeys(slice));
  return generated.every((key) => shared.has(key));
}

/** True when every slot is generated and every generated row is shared with the client. */
export function isBulkIncorpShareComplete(
  responses: ChecklistItemResponses,
  slice?: Pick<
    ChecklistItemStateSlice,
    'sharedIncorpDraftDocs' | 'incorpDraftsSharedAt' | 'reviewStatus'
  >,
  labelOptions?: IncorpDraftLabelOptions,
): boolean {
  const slots = incorpDraftDocSlotsFromResponses(responses, {
    ...labelOptions,
    frozen: labelOptions?.frozen ?? isIncorpSlotSetFrozen(slice),
  });
  return allIncorpDraftSlotsGenerated(slots) && areAllGeneratedIncorpDraftsShared(slots, slice);
}

export function filterClientVisibleIncorpDrafts(
  responses: ChecklistItemResponses,
  pre7State?: ChecklistItemStateSlice,
  labelOptions?: IncorpDraftLabelOptions,
): IncorpDraftDocLink[] {
  return incorpDraftDocLinksFromResponses(responses, labelOptions).filter((link) =>
    isIncorpDraftSharedWithClient(pre7State, link.doc, link.audience),
  );
}

export function hasAnyClientVisibleIncorpDraft(
  responses: ChecklistItemResponses,
  pre7State?: ChecklistItemStateSlice,
  labelOptions?: IncorpDraftLabelOptions,
): boolean {
  return filterClientVisibleIncorpDrafts(responses, pre7State, labelOptions).length > 0;
}

/**
 * Pre-7 was shared with the client or accepted: the slot set is frozen, and
 * slots added since (later directors, new doc kinds) become optional.
 */
export function isIncorpSlotSetFrozen(
  slice?: Pick<ChecklistItemStateSlice, 'incorpDraftsSharedAt' | 'reviewStatus'> | null,
): boolean {
  if (!slice) return false;
  return Boolean(slice.incorpDraftsSharedAt?.trim()) || slice.reviewStatus === 'accepted';
}

/** Pre-8 signed upload field for each company draft; director drafts derive theirs from the prefix. */
const INCORP_DRAFT_TO_SIGNED_FIELD: Record<string, string> = {
  'authorisation-letter:company': 'authorisationLetterSignedUrl',
  'acceptance-letter:company': 'acceptanceLetterSignedUrl',
  'moa-subscription-sheet:company': 'moaSubscriptionSheetSignedUrl',
  'aoa-subscription-sheet:company': 'aoaSubscriptionSheetSignedUrl',
};

export function signedUploadFieldForIncorpDraft(
  doc: IncorpDocKind,
  audience: IncorpDocAudience,
): string | undefined {
  if (audience !== 'company') return directorSignedFieldIdFor(doc, audience) ?? undefined;
  return INCORP_DRAFT_TO_SIGNED_FIELD[incorpDocRowKey(doc, audience)];
}
