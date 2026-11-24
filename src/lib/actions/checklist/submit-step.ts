import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { submitDirectFlowStep } from '@/db/repositories/engagements';
import { announceOpenedSteps } from '@/lib/checklist/step-opened-notify';
import { notifyEngagementEvent } from '@/lib/email/notify-engagement-event';

/**
 * A direct-flow step submitted by the project lead from Ask VCFO's "Fill into app", with the same
 * notices the step page's submit route sends: the opened-step notice for the client and the
 * "step submitted" notice to every party. A notice that fails never undoes the submit. It lives in
 * the actions layer because Ask modules never reach a sender themselves.
 */
export async function submitStepWithNotices(ctx: AuthContext, engagementId: string, stepId: string): Promise<Awaited<ReturnType<typeof submitDirectFlowStep>>> {
  const result = await submitDirectFlowStep(ctx, engagementId, stepId, {});
  if (result.outcome === 'invalid') return result;
  if (result.outcome !== 'waiting_on_lead') {
    await announceOpenedSteps(ctx, engagementId).catch((error) => console.warn('[ask-vcfo] fill: opened-step notice failed', error));
  }
  await notifyEngagementEvent({
    engagementId,
    itemId: stepId,
    event: result.outcome === 'waiting_on_lead' ? 'step_waiting_on_lead' : 'step_submitted',
    actorUserId: ctx.userId,
    actorName: ctx.name,
    actorRole: ctx.role,
  }).catch((error) => console.warn('[ask-vcfo] fill: submit notice failed', error));
  return result;
}
