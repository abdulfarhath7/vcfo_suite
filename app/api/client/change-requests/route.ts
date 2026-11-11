import { notifyEngagementEventSoon } from '@/lib/email/send-after-response';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { createClientTimelineRequest } from '@/db/repositories/client-change-requests';
import type { TimelinePhaseDates } from '@/lib/client/client-home';
import { submitClientChangeRequest } from '@/lib/client-portal/change-request';
import { publicErrorMessage } from '@/lib/api-error';

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

  let body: {
    engagementId?: string;
    stepId?: string;
    note?: string;
    kind?: 'step' | 'timeline';
    phases?: TimelinePhaseDates[];
    coiBefore?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // kind 'timeline' (client portal v7 Home › Timeline › Edit): the client asks
  // for new phase dates. Recorded as a pending request + a task for the lead;
  // the schedule changes only when the Project Manager approves it.
  if (body.kind === 'timeline') {
    if (!body.engagementId?.trim() || !body.note?.trim()) {
      return NextResponse.json({ error: 'Add a short reason so the project manager can approve it' }, { status: 400 });
    }
    try {
      const created = await createClientTimelineRequest(
        guard.ctx,
        { engagementId: body.engagementId.trim(), reason: body.note, phases: body.phases ?? [] },
        { coiTo: body.coiBefore },
      );
      if (!created) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      const email = await notifyEngagementEventSoon({
        engagementId: body.engagementId.trim(),
        itemId: 'pre-12',
        event: 'client_change_requested',
        requestLabel: 'the timeline',
        note: `Timeline change request: ${created.reason}`,
        actorUserId: guard.ctx.userId,
      }).catch(() => null);
      return NextResponse.json({ request: created, email }, { status: 201 });
    } catch (error) {
      const message = publicErrorMessage(error, 'Could not send the request');
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const { engagementId, stepId, note } = body;
  if (!engagementId?.trim() || !stepId?.trim() || !note?.trim()) {
    return NextResponse.json({ error: 'Tell us what you would like changed' }, { status: 400 });
  }

  try {
    // BR-07: the same record, notification and audit entry as a request made through Ask VCFO.
    const out = await submitClientChangeRequest(guard.ctx, { engagementId, stepId, note, via: 'manual' });
    if (!out) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json(out, { status: 201 });
  } catch (error) {
    const message = publicErrorMessage(error, 'Could not send the request');
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
