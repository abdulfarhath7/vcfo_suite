import type { IncorpDocAudience } from '@/lib/incorporation-docs/shared';
import type { IncorpDocKind, IncorpDraftUrlField } from '@/lib/incorporation-docs/types';

const DRAFT_FIELD_TARGETS: Record<
  IncorpDraftUrlField,
  { doc: IncorpDocKind; audience: IncorpDocAudience }
> = {
  nrDirectorDir2DraftUrl: { doc: 'dir-2', audience: 'non-resident' },
  residentDirectorDir2DraftUrl: { doc: 'dir-2', audience: 'resident' },
  nrDirectorDir8DraftUrl: { doc: 'dir-8', audience: 'non-resident' },
  residentDirectorDir8DraftUrl: { doc: 'dir-8', audience: 'resident' },
  nrDirectorInc9DraftUrl: { doc: 'inc-9', audience: 'non-resident' },
  residentDirectorInc9DraftUrl: { doc: 'inc-9', audience: 'resident' },
  nrDirectorPanUndertakingDraftUrl: { doc: 'pan-undertaking', audience: 'non-resident' },
  moaDraftUrl: { doc: 'moa', audience: 'company' },
  aoaDraftUrl: { doc: 'aoa', audience: 'company' },
  authorisationLetterDraftUrl: { doc: 'authorisation-letter', audience: 'company' },
  acceptanceLetterDraftUrl: { doc: 'acceptance-letter', audience: 'company' },
  moaSubscriptionSheetDraftUrl: { doc: 'moa-subscription-sheet', audience: 'company' },
  aoaSubscriptionSheetDraftUrl: { doc: 'aoa-subscription-sheet', audience: 'company' },
};

export function buildIncorpDocDownloadUrl(
  engagementId: string,
  doc: IncorpDocKind,
  audience: IncorpDocAudience,
): string {
  const params = new URLSearchParams({ doc, director: audience });
  return `/api/engagements/${encodeURIComponent(engagementId)}/incorporation-docs/download?${params.toString()}`;
}

export function isIncorpDraftUrlField(fieldId: string): fieldId is IncorpDraftUrlField {
  return fieldId in DRAFT_FIELD_TARGETS;
}

export function incorpDocTargetFromDraftField(
  fieldId: string,
): { doc: IncorpDocKind; audience: IncorpDocAudience } | null {
  if (!isIncorpDraftUrlField(fieldId)) return null;
  return DRAFT_FIELD_TARGETS[fieldId];
}
