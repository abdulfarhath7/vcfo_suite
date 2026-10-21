import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { ClientAuditError, listClientAuditDay, listClientAuditEvents } from '@/db/repositories/client-audit';

/**
 * GET /api/client/audit — client-safe audit of the caller's own engagement.
 *   ?before=<iso>  older page (keyset)   ?limit=n (default 60)
 *   ?summary=1     include the 14-day counts   ?day=yyyy-mm-dd  one day (drill-down)
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const url = new URL(request.url);
  try {
    const day = url.searchParams.get('day');
    if (day) return NextResponse.json({ events: await listClientAuditDay(guard.ctx, day) });
    const before = url.searchParams.get('before');
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '60', 10);
    const page = await listClientAuditEvents(guard.ctx, {
      before: before ? new Date(before) : undefined,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 60,
      withSummary: url.searchParams.get('summary') === '1',
    });
    return NextResponse.json(page);
  } catch (e) {
    if (e instanceof ClientAuditError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
