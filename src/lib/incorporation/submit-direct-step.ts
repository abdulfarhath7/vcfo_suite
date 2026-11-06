import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { submitDirectFlowStep } from '@/db/repositories/engagements';
import { notifyEngagementEventSoon } from '@/lib/email/send-after-response';

/**
 * Submitting a pre-incorporation direct-flow step, from the screen or from an approved chat card. It
 * completes the step, or leaves it waiting on the lead's NIC codes. A field still wrong stops it and
 * sends nothing. Every party hears a completed submit; a client's submit that stopped on the NIC
 * codes is the lead's news. Autosave never reaches here.
 */
export async function submitDirectStep(ctx: AuthContext, engagementId: string, itemId: string, responses: Record<string, string>) {
  const result = await submitDirectFlowStep(ctx, engagementId, itemId, responses);
  if (result.outcome === 'invalid') return result;
  const email = await notifyEngagementEventSoon({
    engagementId,
    itemId,
    event: result.outcome === 'waiting_on_lead' ? 'step_waiting_on_lead' : 'step_submitted',
    actorUserId: ctx.userId,
    actorName: ctx.name,
    actorRole: ctx.role,
  });
  return { ...result, email };
}
