import 'server-only';

import type { AuthContext } from '@/auth/guards';
import {
  assertEngagementAccess,
  checklistStateForViewer,
  checklistStateFromRow,
} from '@/db/repositories/engagements';
import { getFilings } from '@/db/repositories/filings';
import { buildSnapshot, type SnapshotEngagement } from '@/lib/ask/snapshot-build';
import type { ProjectSnapshot } from '@/data/ask/schema';

export { buildSnapshot } from '@/lib/ask/snapshot-build';

export interface LoadedProjectSnapshot {
  snapshot: ProjectSnapshot;
  engagementDbId: string;
  engagementSlug: string | null;
  /** Client-redacted state — tools read this, never the raw row. */
  state: ReturnType<typeof checklistStateFromRow>;
  filings: Awaited<ReturnType<typeof getFilings>>['rows'];
}

/**
 * The project snapshot for one engagement the caller can access (client, or
 * super admin previewing a client). The state is redacted as the CLIENT sees
 * it, whoever asks, so a preview never shows firm-only drafts.
 */
export async function loadProjectSnapshot(
  ctx: AuthContext,
  engagementId: string,
  now: Date = new Date(),
): Promise<LoadedProjectSnapshot | null> {
  const access = await assertEngagementAccess(ctx, engagementId);
  if (!access.ok) return null;
  const row = access.row;
  const state = checklistStateForViewer({ role: 'client' }, checklistStateFromRow(row));
  let filings: Awaited<ReturnType<typeof getFilings>>['rows'] = [];
  try {
    filings = (await getFilings(ctx, { engagementId: access.dbId })).rows;
  } catch (error) {
    // Compliance rows are optional context; a snapshot without them still answers.
    console.warn('[ask-vcfo] snapshot filings unavailable', error);
  }
  const engagement: SnapshotEngagement = {
    companyName: row.companyName,
    entityLegalForm: row.entityLegalForm,
    companyType: row.companyType,
    ownershipType: row.ownershipType,
    stage: row.stage,
    incorporationDate: row.incorporationDate,
    schedule: row.schedule,
  };
  return {
    snapshot: buildSnapshot({ engagement, state, filings, now }),
    engagementDbId: access.dbId,
    engagementSlug: row.slug ?? null,
    state,
    filings,
  };
}
