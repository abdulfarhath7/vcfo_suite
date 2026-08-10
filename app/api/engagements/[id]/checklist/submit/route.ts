import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { submitChecklistItem } from '@/db/repositories/engagements';
import { notifyEngagementEvent } from '@/lib/email/notify-engagement-event';

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  itemId: z.string().trim().min(1),
  responses: z.record(z.string(), z.string()).default({}),
});

/** POST /api/engagements/:id/checklist/submit — client locks milestone for review. */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  try {
    const checklistState = await submitChecklistItem(
      guard.ctx,
      id,
      body.data.itemId,
      body.data.responses,
    );
    const email = await notifyEngagementEvent({
      engagementId: id,
      itemId: body.data.itemId,
      event: 'client_submitted',
      actorUserId: guard.ctx.userId,
    });
    return NextResponse.json({ checklistState, email });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'submit_failed';
    const status =
      message.includes('Only clients') ? 403
      : message.includes('not found') || message.includes('not permitted') ? 404
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
