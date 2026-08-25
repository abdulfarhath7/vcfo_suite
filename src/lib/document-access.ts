/**
 * Path A document visibility helpers (mirrors `src/db/repositories/documents.ts`).
 * Used by unit tests so intern isolation does not require a live database.
 */

import { engagementIdAliases } from '@/lib/legacy-engagement-ids';

type InternEngagementAccess = {
  id: string;
  internId: string | null | undefined;
  leadIds?: readonly string[] | null;
};

/** Intern may only read documents on assigned engagements (primary lead, leadIds, or membership). */
export function internMayAccessEngagementDocuments(
  internId: string | undefined,
  engagement: InternEngagementAccess,
  memberEngagementIds: readonly string[] = [],
): boolean {
  if (!internId) return false;
  if (engagement.internId === internId) return true;
  if (engagement.leadIds?.includes(internId)) return true;
  const aliases = new Set(engagementIdAliases(engagement.id));
  return memberEngagementIds.some((id) => aliases.has(id) || engagementIdAliases(id).some((alias) => aliases.has(alias)));
}

/** Filter a document list down to intern-assigned engagements. */
export function internVisibleDocuments<T extends { engagementId: string }>(
  internId: string | undefined,
  docs: T[],
  engagements: InternEngagementAccess[],
  memberEngagementIds: readonly string[] = [],
): T[] {
  const allowed = new Set(
    engagements
      .filter((engagement) => internMayAccessEngagementDocuments(internId, engagement, memberEngagementIds))
      .flatMap((engagement) => engagementIdAliases(engagement.id)),
  );
  return docs.filter((doc) => engagementIdAliases(doc.engagementId).some((id) => allowed.has(id)));
}
