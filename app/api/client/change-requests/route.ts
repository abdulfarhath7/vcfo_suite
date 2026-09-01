import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { createClientChangeRequest } from '@/db/repositories/client-change-requests';
import { clientRequestStepChange } from '@/db/repositories/engagements';
import { notifyEngagementEvent } from '@/lib/email/notify-engagement-event';

/**
 * POST /api/client/change-requests — the client asks the firm to change
 * something on a checklist step.
 *
 * Three things happen, in this order:
 *   1. the ask is recorded as a task in the delivery lead's queue
 *   2. the step moves to `change_requested` and REOPENS, reusing the existing
 *      reject/unlock mechanics so every step after it re-locks the same way a
 *      manager rejection re-locks them
 *   3. the lead and the managers are emailed with the client's own words
 *
 * Step 2 only applies to a step that is actually with the client. A note about
 * a step still in the firm's hands is recorded and mailed, but changes no
 * state — there is nothing to reopen.
 *
 * The repository runs `assertEngagementAccess`, so a request naming an
 * engagement the caller cannot see comes back 404 rather than a 403 that would
 * confirm it exists.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: { engagementId?: string; stepId?: string; note?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { engagementId, stepId, note } = body;
  if (!engagementId?.trim() || !stepId?.trim() || !note?.trim()) {
    return NextResponse.json({ error: 'Tell us what you would like changed' }, { status: 400 });
  }

  try {
    const created = await createClientChangeRequest(guard.ctx, {
      engagementId: engagementId.trim(),
      stepId: stepId.trim(),
      note,
    });
    if (!created) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Reopen the step when it was actually with the client. A note on a step
    // the firm still holds is recorded and mailed, but reopens nothing.
    let checklistState = null;
    try {
      const reopened = await clientRequestStepChange(
        guard.ctx,
        engagementId.trim(),
        stepId.trim(),
        note,
      );
      checklistState = reopened.checklistState;
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message !== 'step_not_with_client') throw err;
    }

    // The lead did the work and the manager approved it, so both hear about it.
    const email = await notifyEngagementEvent({
      engagementId: engagementId.trim(),
      itemId: stepId.trim(),
      event: 'client_change_requested',
      note,
      actorUserId: guard.ctx.userId,
    }).catch(() => null);

    return NextResponse.json({ request: created, checklistState, email }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send the request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
