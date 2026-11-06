import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { createAskChangeset } from '@/db/repositories/ask-changesets';
import { appendAskRunStep } from '@/db/repositories/ask-runs';
import { listManagerIdsForEngagement } from '@/db/repositories/engagement-managers-membership';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import { changesetHash } from '@/lib/ask/changeset/hash';
import type { ChangesetDraft } from '@/lib/ask/changeset/types';
import { isAdminOrManager } from '@/lib/auth';

const CARD_DAYS = 7;

/** Puts a card in the chat, and tells the manager when a row on it is theirs to approve. */
export async function createReviewCard(
  ctx: AuthContext,
  draft: ChangesetDraft,
  run: { runId: string; conversationId: string | null; companyName: string; now: Date },
): Promise<string | null> {
  const changesetId = await createAskChangeset(ctx, {
    draft,
    contentHash: changesetHash(draft.rows.map((r) => ({ action: r.action, target: r.target, newValue: r.newValue }))),
    conversationId: run.conversationId,
    runId: run.runId,
    expiresAt: new Date(run.now.getTime() + CARD_DAYS * 86_400_000),
  });
  if (!changesetId) return null;
  await appendAskRunStep(ctx, run.runId, { kind: 'approval', name: 'changeset', label: draft.title, tier: draft.tier, status: 'waiting', changesetId, output: { rows: draft.rows.length } });

  const managerRows = draft.rows.filter((r) => r.target.needsManager === true);
  if (managerRows.length > 0 && !isAdminOrManager(ctx.role) && draft.engagementId) {
    const managers = await listManagerIdsForEngagement(draft.engagementId);
    await createNotificationsForUsers(
      managers.map((userId) => ({
        userId,
        kind: 'checklist.review' as const,
        title: `${run.companyName}: values to approve`,
        body: `${ctx.name} prepared ${managerRows.length} value${managerRows.length === 1 ? '' : 's'} for you to approve.`,
        engagementId: draft.engagementId,
        companyName: run.companyName,
        href: `/app/manager/ask?changeset=${changesetId}`,
      })),
    ).catch((error) => console.warn('[ask-vcfo] manager notice failed', error));
  }
  return changesetId;
}
