import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { approveMeeting, getMeeting } from '@/db/repositories/board-meetings';
import { meetingError, type RouteContext } from '../../_respond';

/**
 * POST /api/board-meetings/:id/approve — admin, super admin or manager approves the notice.
 * GL-07: approving no longer emails the directors. The screen opens the "Send email" pop-up
 * right after, and the notice goes out only on its Send (`POST /api/board-meetings/:id/send-notice`);
 * until then the meeting reads "approved" with a "Send notice" button.
 */
export async function POST(_request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  try {
    await approveMeeting(guard.ctx, id);
    return NextResponse.json({ meeting: await getMeeting(guard.ctx, id) });
  } catch (e) {
    return meetingError(e);
  }
}
