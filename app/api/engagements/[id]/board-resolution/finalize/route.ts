import { NextResponse } from 'next/server';
import {
  assertEngagementBoardResolutionAccess,
} from '@/lib/api/board-resolution-access';
import { requireRole } from '@/lib/api/require-role';
import { finalizeBoardResolution } from '@/db/repositories/board-resolution';

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
  if (access.forbidden) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const boardResolution = await finalizeBoardResolution(auth.ctx, access.dbId);
    return NextResponse.json({ boardResolution });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'finalize_failed';
    const status =
      message.includes('not found') ? 404
      : message.includes('may not') ? 403
      : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
