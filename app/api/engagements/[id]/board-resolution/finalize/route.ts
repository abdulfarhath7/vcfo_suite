import { NextResponse } from 'next/server';
import {
  assertEngagementBoardResolutionAccess,
} from '@/lib/api/board-resolution-access';
import { requireRole } from '@/lib/api/require-role';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  finalizeBoardResolution,
  getBoardResolutionByEngagementId,
} from '@/db/repositories/board-resolution';
import {
  checklistStateFromRow,
  patchChecklistItem,
  toAppEngagement,
} from '@/db/repositories/engagements';
import { notifyEngagementEvent } from '@/lib/email/notify-engagement-event';

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/engagements/:id/board-resolution/finalize — release draft to client. */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireRole(['admin', 'manager', 'intern', 'super_admin']);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id: engagementParam } = await context.params;
  const access = await assertEngagementBoardResolutionAccess(auth.ctx, engagementParam);
  if (access.notFound) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  if (access.forbidden || !access.row) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const engagement = toAppEngagement(access.row);
  const checklistState = checklistStateFromRow(access.row);
  const pre2 = checklistState['pre-2'];
  const alreadyDelivered = Boolean(pre2?.deliveredToClientAt?.trim());

  try {
    const existing = await getBoardResolutionByEngagementId(auth.ctx, access.dbId);
    const alreadyFinalized = existing?.status === 'finalized';
    const boardResolution = await finalizeBoardResolution(auth.ctx, access.dbId);

    const now = new Date();
    const sharedDate = now.toISOString().slice(0, 10);
    if (!alreadyDelivered) {
      try {
        await patchChecklistItem(
          auth.ctx,
          engagement.id,
          'pre-2',
          {
            status: 'completed',
            completedOn: now.toISOString(),
            deliveredToClientAt: now.toISOString(),
            responses: {
              boardResolutionSharedAt:
                pre2?.responses?.boardResolutionSharedAt?.trim() || sharedDate,
            },
          },
          checklistState,
        );
      } catch (err) {
        console.error('[board-resolution] could not mark pre-2 delivered after finalize', err);
      }
    }

    if (!alreadyFinalized) {
      await recordAuditEvent(auth.ctx, {
        engagementId: engagement.id,
        action: 'board_resolution.finalize',
        summary: 'Board resolution finalized and released to client',
        actorEmail: auth.ctx.email,
        actorName: auth.ctx.name,
      });
    }

    const email = await notifyEngagementEvent({
      engagementId: engagement.id,
      itemId: 'pre-2',
      event: 'board_resolution_shared',
      actorUserId: auth.ctx.userId,
      skipInAppNotifications: alreadyFinalized && alreadyDelivered,
    });

    return NextResponse.json({ boardResolution, email });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'finalize_failed';
    const status =
      message.includes('not found') ? 404
      : message.includes('may not') ? 403
      : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
