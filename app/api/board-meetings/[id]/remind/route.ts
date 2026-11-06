import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { remindDirectors } from '@/lib/actions/board-meetings/flows';
import { meetingError, type RouteContext } from '../../_respond';

/** POST /api/board-meetings/:id/remind — email the directors who have not replied. Staff. */
export async function POST(_request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  try {
    return NextResponse.json({ sent: await remindDirectors(guard.ctx, id) });
  } catch (e) {
    return meetingError(e);
  }
}
