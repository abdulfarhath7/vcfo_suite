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

/** Several proposals go on one card, the highest tier deciding how it is confirmed. */
export function oneCard(drafts: readonly ChangesetDraft[], lastRead: string | null): ChangesetDraft {
  const recipients = [...new Map(drafts.flatMap((draft) => draft.recipients ?? []).map((person) => [person.email ?? person.name, person])).values()];
  const source = lastRead ? { kind: 'record' as const, fileName: lastRead } : null;
  return {
    title: drafts.length === 1 ? drafts[0]!.title : `${drafts.length} changes to review`,
    tier: drafts.some((draft) => draft.tier === 'T3') ? 'T3' : 'T2',
    // A firm-wide row has no project, so a mixed card takes the project of the row that has one.
    engagementId: drafts.find((draft) => draft.engagementId)?.engagementId ?? null,
    rows: drafts.flatMap((draft) => draft.rows).map((row) => ({ ...row, source: row.source ?? source })),
    ...(drafts.some((draft) => draft.tier === 'T3') ? { recipients } : {}),
  };
}

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
