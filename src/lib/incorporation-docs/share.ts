import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { incorpDocRowKey } from '@/lib/incorporation-docs/paths';
import type { IncorpDraftDocLink, IncorpDraftDocSlot } from '@/lib/incorporation-docs/paths';
import {
  incorpDraftDocLinksFromResponses,
  incorpDraftDocSlotsFromResponses,
  type IncorpDraftLabelOptions,
} from '@/lib/incorporation-docs/paths';
import type { IncorpDocAudience } from '@/lib/incorporation-docs/shared';
import { INCORP_DOC_KINDS, type IncorpDocKind } from '@/lib/incorporation-docs/types';
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
  const validAudiences = new Set(['non-resident', 'resident', 'company']);
  return validDocs.has(doc) && validAudiences.has(audience);
}

/** All incorporation draft slots (director forms + company documents). */
export function incorpDraftSlotCount(slots: IncorpDraftDocSlot[]): number {
  return slots.length;
}

export function allIncorpDraftSlotsGenerated(slots: IncorpDraftDocSlot[]): boolean {
  return slots.length > 0 && slots.every((slot) => slot.path.trim().length > 0);
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
    'sharedIncorpDraftDocs' | 'incorpDraftsSharedAt'
  >,
): boolean {
  const slots = incorpDraftDocSlotsFromResponses(responses);
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

/** Pre-8 signed upload field for each incorporation draft slot. */
const INCORP_DRAFT_TO_SIGNED_FIELD: Record<string, string> = {
  'dir-2:non-resident': 'nrDirectorDir2SignedUrl',
  'dir-2:resident': 'residentDirectorDir2SignedUrl',
  'dir-8:non-resident': 'nrDirectorDir8SignedUrl',
  'dir-8:resident': 'residentDirectorDir8SignedUrl',
  'inc-9:non-resident': 'nrDirectorInc9SignedUrl',
  'inc-9:resident': 'residentDirectorInc9SignedUrl',
  'pan-undertaking:non-resident': 'nrDirectorPanUndertakingSignedUrl',
  'authorisation-letter:company': 'authorisationLetterSignedUrl',
  'acceptance-letter:company': 'acceptanceLetterSignedUrl',
  'moa-subscription-sheet:company': 'moaSubscriptionSheetSignedUrl',
  'aoa-subscription-sheet:company': 'aoaSubscriptionSheetSignedUrl',
};

export function signedUploadFieldForIncorpDraft(
  doc: IncorpDocKind,
  audience: IncorpDocAudience,
): string | undefined {
  return INCORP_DRAFT_TO_SIGNED_FIELD[incorpDocRowKey(doc, audience)];
}
