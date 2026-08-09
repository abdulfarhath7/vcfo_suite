import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import {
  checklistStateFromRow,
  getEngagementById,
  patchChecklistItem,
} from '@/db/repositories/engagements';
import { engagementDbId } from '@/lib/legacy-engagement-ids';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { notifyEngagementEvent } from '@/lib/email/notify-engagement-event';
import { emptyEmailDispatch } from '@/lib/email/email-dispatch';

type RouteContext = { params: Promise<{ id: string }> };

const patchBodySchema = z.object({
  itemId: z.string().trim().min(1),
  patch: z.record(z.string(), z.unknown()),
  current: z.record(z.string(), z.unknown()).optional(),
});

/** GET /api/engagements/:id/checklist — load checklist_state for one engagement. */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const row = await getEngagementById(guard.ctx, engagementDbId(id));
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ checklistState: checklistStateFromRow(row) });
}

/**
 * POST /api/engagements/:id/checklist — merge one checklist item patch.
 * Used by staff autosave / lead request-approval / general updateItem.
 * Clients may only patch responses / notes / status — not review or lock fields.
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const body = await parseJsonBody(request, patchBodySchema);
  if (body.ok === false) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  try {
    const before = await getEngagementById(guard.ctx, engagementDbId(id));
    const prevSlice = before
      ? checklistStateFromRow(before)[body.data.itemId]
      : undefined;

    let patch = body.data.patch as Partial<ChecklistItemStateSlice>;
    if (guard.ctx.role === 'client') {
      const {
        reviewStatus: _rs,
        reviewSource: _src,
        reviewedAt: _ra,
        reviewedBy: _rb,
        rejectionNote: _rn,
        locked: _lk,
        unlockedFields: _uf,
        clientSubmittedAt: _cs,
        deliveredToClientAt: _dt,
        sharedIncorpDraftDocs: _sd,
        incorpDraftsSharedAt: _isa,
        workflowStage: _ws,
        completedOn: _co,
        assigneeId: _ai,
        ...safe
      } = patch;
      patch = safe;
    }

    const checklistState = await patchChecklistItem(
      guard.ctx,
      id,
      body.data.itemId,
      patch,
      body.data.current as Record<string, ChecklistItemStateSlice> | undefined,
    );

    const nextSlice = checklistState[body.data.itemId];
    const newlyDelivered =
      !prevSlice?.deliveredToClientAt?.trim() && Boolean(nextSlice?.deliveredToClientAt?.trim());
    const email = newlyDelivered
      ? await notifyEngagementEvent({
          engagementId: id,
          itemId: body.data.itemId,
          event: 'delivered',
          actorUserId: guard.ctx.userId,
        })
      : emptyEmailDispatch();

    return NextResponse.json({ checklistState, email });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'save_failed';
    const status = message.includes('not found') || message.includes('not permitted') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
