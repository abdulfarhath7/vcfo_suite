import { audienceForDirectorFieldId, type IncorpDocAudience } from '@/lib/incorporation-docs/audiences';
import {
  draftFieldIdFor,
  INCORP_DOC_KINDS,
  type IncorpDocKind,
  type IncorpDraftUrlField,
} from '@/lib/incorporation-docs/types';

export function buildIncorpDocDownloadUrl(
  engagementId: string,
  doc: IncorpDocKind,
  audience: IncorpDocAudience,
): string {
  const params = new URLSearchParams({ doc, director: audience });
  return `/api/engagements/${encodeURIComponent(engagementId)}/incorporation-docs/download?${params.toString()}`;
}

/** Every draft the viewer may see, as one zip (client: shared rows only). */
export function buildIncorpDraftsZipUrl(engagementId: string): string {
  return `/api/engagements/${encodeURIComponent(engagementId)}/incorporation-docs/download-all`;
}

export function isIncorpDraftUrlField(fieldId: string): fieldId is IncorpDraftUrlField {
  return incorpDocTargetFromDraftField(fieldId) !== null;
}

/** The draft a pre-7 response id holds — `residentDirector2Dir8DraftUrl` → dir-8 / resident-2. */
export function incorpDocTargetFromDraftField(
  fieldId: string,
): { doc: IncorpDocKind; audience: IncorpDocAudience } | null {
  const audience: IncorpDocAudience = audienceForDirectorFieldId(fieldId) ?? 'company';
  for (const doc of INCORP_DOC_KINDS) {
    if (draftFieldIdFor(doc, audience) === fieldId) return { doc, audience };
  }
  return null;
}
