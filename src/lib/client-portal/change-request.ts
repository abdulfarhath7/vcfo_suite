import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { createClientChangeRequest } from '@/db/repositories/client-change-requests';
import { checklistStateForViewer, clientRequestStepChange } from '@/db/repositories/engagements';
import { notifyEngagementEventSoon } from '@/lib/email/send-after-response';
import { isDirectFlowStep } from '@/lib/incorporation/pre-inc-direct-flow';

/**
 * BR-07: the one way a client's "Request a change" is recorded, whether the client typed it in the
 * pop-up or asked the chatbot. Both paths make the same change-request task for the lead, the same
 * notification and the same audit record; only `via` differs.
 *
 *   1. the ask is recorded as a task in the delivery lead's queue;
 *   2. a step that was with the client reopens (a step the firm holds is recorded, not reopened);
 *   3. the lead and the managers hear about it, in the app and by email;
 *   4. the audit log keeps the client member, the time, the step and the path.
 */
export async function submitClientChangeRequest(
  ctx: AuthContext,
  input: { engagementId: string; stepId: string; note: string; via: 'manual' | 'chat' },
) {
  const engagementId = input.engagementId.trim();
  const stepId = input.stepId.trim();
  const note = input.note.trim();
  const request = await createClientChangeRequest(ctx, { engagementId, stepId, note });
  if (!request) return null;

  let checklistState = null;
  try {
    const reopened = await clientRequestStepChange(ctx, engagementId, stepId, note);
    checklistState = checklistStateForViewer(ctx, reopened.checklistState);
    if (isDirectFlowStep(stepId)) {
      // The client reopened a submitted step: every party hears it.
      await notifyEngagementEventSoon({
        engagementId,
        itemId: stepId,
        event: 'step_reopened',
        actorUserId: ctx.userId,
        actorName: ctx.name,
        actorRole: ctx.role,
      }).catch(() => null);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message !== 'step_not_with_client') throw err;
  }

  // The lead did the work and the manager approved it, so both hear about it.
  const email = await notifyEngagementEventSoon({
    engagementId,
    itemId: stepId,
    event: 'client_change_requested',
    note,
    actorUserId: ctx.userId,
  }).catch(() => null);

  await recordAuditEvent(ctx, {
    engagementId,
    action: 'client.change_requested',
    summary: `${ctx.name || 'The client'} requested a change (${input.via === 'chat' ? 'through Ask VCFO' : 'typed'})`,
    metadata: { stepId, via: input.via, note },
  });

  return { request, checklistState, email };
}
