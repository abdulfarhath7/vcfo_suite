import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { assertLeadMayEdit, getBoardResolutionByEngagementId, saveBoardResolutionDraft } from '@/db/repositories/board-resolution';
import { currentNocSnapshot, getNocTemplateOverride, recordBoardResolutionVersion } from '@/db/repositories/board-resolution-noc';
import { checklistStateFromRow, getEngagementById, toAppEngagement } from '@/db/repositories/engagements';
import { collectBoardResolutionMissingFieldRefs, isPre1SubmittedForBoardResolution } from '@/lib/api/board-resolution-errors';
import { generateAndStoreBoardResolution } from '@/lib/api/board-resolution-generate';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { directorResponsesFromState } from '@/lib/incorporation/proposed-directors';
import { withNocVariantOverride } from '@/lib/noc/receive';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { boardResolutionDecision, type BoardResolutionOutcome } from './draft-br-decision';

/**
 * Draft Board Resolution (pre-2) after a "fill everything" run: when no draft exists and its inputs
 * are all there, the existing generator makes it, exactly as the Generate button on the step does
 * (`app/api/engagements/[id]/board-resolution/generate/route.ts`, without overrides or edits).
 * Only the trigger is new. Otherwise it says exactly what is missing. Never throws: the fill itself
 * already finished, so a failure here is only reported.
 *
 * It renders a .docx and uploads it, so it runs only inside the fill's Inngest job (an Auto run);
 * a Manual run reports the decision and leaves the Generate button to the person.
 */
export async function draftBoardResolutionAfterFill(ctx: AuthContext, engagementId: string, opts: { generate: boolean }): Promise<BoardResolutionOutcome> {
  try {
    if (ctx.role === 'client') return { kind: 'skipped', reason: 'Only staff draft the board resolution.' };
    const row = await getEngagementById(ctx, engagementDbId(engagementId));
    if (!row) return { kind: 'skipped', reason: 'This project is not available.' };
    const state = checklistStateFromRow(row);
    const existing = await getBoardResolutionByEngagementId(ctx, row.id);
    const { pre1 } = directorResponsesFromState(state);
    const engagement = toAppEngagement(row);
    const decision = boardResolutionDecision({
      hasDraft: Boolean(existing),
      pre1Submitted: isPre1SubmittedForBoardResolution(state['pre-1'] as ChecklistItemStateSlice | undefined),
      missing: collectBoardResolutionMissingFieldRefs(pre1, engagement).map((ref) => ref.label),
    });
    if (decision.kind !== 'generate' || !opts.generate) return decision.kind === 'generate' ? { kind: 'ready' } : decision;
    assertLeadMayEdit(ctx, state);
    const override = await getNocTemplateOverride(ctx, row.id).catch(() => null);
    const { content, storagePath, templateFingerprint } = await generateAndStoreBoardResolution(withNocVariantOverride(engagement, override), state, {});
    await saveBoardResolutionDraft(ctx, engagement.id, content, storagePath, templateFingerprint);
    try {
      const fields = currentNocSnapshot(row, override);
      await recordBoardResolutionVersion(ctx, row.id, { variant: fields.__variant ?? '', fields });
    } catch (error) {
      console.error('[ask-vcfo] board resolution version not recorded', error instanceof Error ? error.message : error);
    }
    await recordAuditEvent(ctx, {
      engagementId: engagement.id,
      action: 'board_resolution.generate',
      summary: 'Ask VCFO generated the draft board resolution after a fill',
      actorEmail: ctx.email,
      actorName: ctx.name,
      metadata: { via: 'ask' },
    });
    return { kind: 'generated' };
  } catch (error) {
    console.error('[ask-vcfo] draft board resolution after fill failed', error instanceof Error ? error.message : error);
    return { kind: 'skipped', reason: 'I could not generate the draft board resolution; use Generate on the step.' };
  }
}
