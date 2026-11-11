import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { getStatutoryCalendar } from '@/db/repositories/statutory-calendar';
import { canImportStatutoryCalendar } from '@/lib/statutory-calendar/access';
import { isFyKey } from '@/lib/statutory-calendar/fy';
import { buildStatutoryCalendarWorkbook, statutoryCalendarFileName } from '@/lib/statutory-calendar/template';
import { statutoryCalendarError } from '../_respond';

/**
 * GET /api/statutory-calendar/template — the blank import template, as Excel. With `?fy=2026-27`
 * the template comes filled with that year's calendar, as a starting point for the next. Admin only.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canImportStatutoryCalendar(guard.ctx.role)) return NextResponse.json({ error: 'not permitted' }, { status: 403 });
  const fy = new URL(request.url).searchParams.get('fy');
  if (fy !== null && !isFyKey(fy)) return NextResponse.json({ error: 'invalid financial year' }, { status: 400 });
  try {
    const calendar = fy ? await getStatutoryCalendar(guard.ctx, fy) : null;
    const bytes = await buildStatutoryCalendarWorkbook(calendar?.deadlines ?? []);
    const name = statutoryCalendarFileName(calendar?.fy.label);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return statutoryCalendarError(err, 'template_failed');
  }
}
