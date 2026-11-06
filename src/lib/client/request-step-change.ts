import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { createClientChangeRequest } from '@/db/repositories/client-change-requests';
import { checklistStateForViewer, clientRequestStepChange } from '@/db/repositories/engagements';
import { notifyEngagementEventSoon } from '@/lib/email/send-after-response';
import { isDirectFlowStep } from '@/lib/incorporation/pre-inc-direct-flow';

/**
 * The client asks the firm to change something on a step, from the portal or from an approved chat
 * card. Three things happen, in this order:
 *   1. the ask is recorded as a task in the delivery lead's queue
 *   2. the step moves to `change_requested` and REOPENS, reusing the existing
 *      reject/unlock mechanics so every step after it re-locks the same way a
 *      manager rejection re-locks them
 *   3. the lead and the managers are emailed with the client's own words
 *
 * Step 2 only applies to a step that is actually with the client. A note about
 * a step still in the firm's hands is recorded and mailed, but changes no
 * state — there is nothing to reopen. Null when the project is not theirs.
 */
export async function requestClientStepChange(ctx: AuthContext, input: { engagementId: string; stepId: string; note: string }) {
  const { engagementId, stepId, note } = input;
  const created = await createClientChangeRequest(ctx, { engagementId, stepId, note });
  if (!created) return null;

  // Reopen the step when it was actually with the client. A note on a step
  // the firm still holds is recorded and mailed, but reopens nothing.
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

  return { request: created, checklistState, email };
}
