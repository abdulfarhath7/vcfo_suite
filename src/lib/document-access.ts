/**
 * Path A document visibility helpers (mirrors `src/db/repositories/documents.ts`).
 * Used by unit tests so intern isolation does not require a live database.
 */

/** Intern may only read documents on assigned engagements (primary lead or membership). */
export function internMayAccessEngagementDocuments(
  internId: string | undefined,
  engagement: { id: string; internId: string | null | undefined },
  memberEngagementIds: readonly string[] = [],
): boolean {
  if (!internId) return false;
  if (engagement.internId === internId) return true;
  return memberEngagementIds.includes(engagement.id);
}

/** Filter a document list down to intern-assigned engagements. */
export function internVisibleDocuments<T extends { engagementId: string }>(
  internId: string | undefined,
  docs: T[],
  engagements: Array<{ id: string; internId: string | null | undefined }>,
  memberEngagementIds: readonly string[] = [],
): T[] {
  const allowed = new Set(
    engagements
      .filter((engagement) => internMayAccessEngagementDocuments(internId, engagement, memberEngagementIds))
      .map((engagement) => engagement.id),
  );
  return docs.filter((doc) => allowed.has(doc.engagementId));
}
