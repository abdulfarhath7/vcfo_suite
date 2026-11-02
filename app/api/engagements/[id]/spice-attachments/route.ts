import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { getSpiceAttachments } from '@/db/repositories/spice-attachments';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/engagements/:id/spice-attachments — the SPICe+ Part B attachments for one engagement
 * with a status for each (spec T6 of the Board resolution (NOC) page). Staff only; the
 * repository scopes by role, so another lead's or manager's engagement is 403 and a missing one 404.
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAnyRole('intern', 'manager', 'admin', 'super_admin');
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  try {
    const result = await getSpiceAttachments(auth.ctx, id);
    if (result.ok === false) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, list: result.list });
  } catch (err) {
    console.error('[spice-attachments] load failed', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'load_failed' }, { status: 500 });
  }
}
