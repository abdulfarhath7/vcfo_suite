import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { getPortalFilings } from '@/db/repositories/client-compliances';
import { filingsIcs } from '@/lib/client-portal/compliances';

/** GET /api/client/compliances/:id/ics — "Add to my calendar" for one filing. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Filing not found' }, { status: 404 });
  const rows = await getPortalFilings(guard.ctx, { ids: [id] });
  const row = rows[0];
  if (!row) return NextResponse.json({ error: 'Filing not found' }, { status: 404 });
  const file = `${row.name}-${row.period}`.replace(/[^\w-]+/g, '-').replace(/-+/g, '-');
  return new Response(filingsIcs([row]), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="${file}.ics"`,
      'cache-control': 'no-store',
    },
  });
}
