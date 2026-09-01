import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { reviewChecklistItem } from '@/db/repositories/engagements';
import { notifyEngagementEvent } from '@/lib/email/notify-engagement-event';

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  itemId: z.string().trim().min(1),
  action: z.enum(['accept', 'reject']),
  note: z.string().trim().max(2000).nullable().optional(),
});

/** POST /api/engagements/:id/checklist/review — manager/admin accept/reject submission. */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  try {
    const checklistState = await reviewChecklistItem(
      guard.ctx,
      id,
      body.data.itemId,
      body.data.action,
      body.data.note,
    );
    const email = await notifyEngagementEvent({
      engagementId: id,
      itemId: body.data.itemId,
      event: body.data.action === 'accept' ? 'review_accepted' : 'review_rejected',
      note: body.data.note,
      actorUserId: guard.ctx.userId,
      outlookCtx: guard.ctx,
    });

    // Accepting also hands the step to the client, so they are told it is their
    // turn. Separate from `review_accepted`, which is the team's own record of
    // the decision. A failure here must not fail the review that already
    // committed, so it is reported alongside rather than thrown.
    let clientApprovalEmail: Awaited<ReturnType<typeof notifyEngagementEvent>> | null = null;
    if (body.data.action === 'accept') {
      clientApprovalEmail = await notifyEngagementEvent({
        engagementId: id,
        itemId: body.data.itemId,
        event: 'step_awaiting_client_approval',
        actorUserId: guard.ctx.userId,
        outlookCtx: guard.ctx,
      }).catch(() => null);
    }

    return NextResponse.json({ checklistState, email, clientApprovalEmail });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'review_failed';
    const status =
      message.includes('may not review') ? 403
      : message.includes('not found') || message.includes('not permitted') ? 404
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
