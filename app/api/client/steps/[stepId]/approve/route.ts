import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { clientApproveStep } from '@/db/repositories/engagements';
import { notifyEngagementEvent } from '@/lib/email/notify-engagement-event';

type RouteContext = { params: Promise<{ stepId: string }> };

/**
 * POST /api/client/steps/:stepId/approve — the client signs off a step a
 * manager handed them.
 *
 * The client has exactly one engagement, so the id comes in the body rather
 * than the path, and `clientApproveStep` runs the access check: a caller naming
 * an engagement they cannot see gets "not found", never a row from another
 * firm's file. Role scoping is in the repository, not here.
 *
 * Approving the last outstanding step in a phase sends ONE phase-approved
 * email to the lead and managers. The repository stamps the completing step
 * before returning, so a double-click, a refresh or a retry finds the stamp and
 * sends nothing.
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { stepId } = await context.params;

  let body: { engagementId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const engagementId = body.engagementId?.trim();
  if (!engagementId || !stepId?.trim()) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const { checklistState, phaseCompleted } = await clientApproveStep(
      guard.ctx,
      engagementId,
      stepId.trim(),
    );

    let email: Awaited<ReturnType<typeof notifyEngagementEvent>> | null = null;
    if (phaseCompleted) {
      // One email for the whole phase, to the lead and the managers. The
      // approval itself is already committed, so a send failure is reported,
      // never thrown back at the client.
      email = await notifyEngagementEvent({
        engagementId,
        itemId: stepId.trim(),
        event: 'phase_approved',
        requestLabel: phaseCompleted.title,
        actorUserId: guard.ctx.userId,
      }).catch(() => null);
    }

    return NextResponse.json({
      checklistState,
      phaseApproved: phaseCompleted ? { id: phaseCompleted.id, title: phaseCompleted.title } : null,
      email,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'approve_failed';
    const friendly: Record<string, string> = {
      step_not_awaiting_client_approval: 'This step is not waiting for your approval yet.',
    };
    const status =
      message === 'Only the client may approve a step'
        ? 403
        : message.includes('not found') || message.includes('not permitted')
          ? 404
          : 400;
    return NextResponse.json({ error: friendly[message] ?? message }, { status });
  }
}
