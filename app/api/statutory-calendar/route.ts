import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { getStatutoryCalendar, listStatutoryCalendarYears } from '@/db/repositories/statutory-calendar';
import { canImportStatutoryCalendar } from '@/lib/statutory-calendar/access';
import { fyKeyForIso, importableFyKeys, isFyKey, todayIsoInIndia } from '@/lib/statutory-calendar/fy';
import type { StatutoryCalendarResponse } from '@/lib/statutory-calendar/types';
import { statutoryCalendarError } from './_respond';

/**
 * GET /api/statutory-calendar?fy=2027-28 — one financial year's statutory calendar (this year by
 * default), the years that have one, and whether this user may import. Every signed-in role.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const today = todayIsoInIndia();
  const currentFy = fyKeyForIso(today);
  const asked = new URL(request.url).searchParams.get('fy');
  if (asked !== null && !isFyKey(asked)) return NextResponse.json({ error: 'invalid financial year' }, { status: 400 });
  try {
    const [calendar, years] = await Promise.all([
      getStatutoryCalendar(guard.ctx, asked ?? currentFy),
      listStatutoryCalendarYears(guard.ctx),
    ]);
    const canImport = canImportStatutoryCalendar(guard.ctx.role);
    const body: StatutoryCalendarResponse = {
      calendar,
      years,
      currentFy,
      canImport,
      importableYears: canImport ? importableFyKeys(today) : [],
    };
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return statutoryCalendarError(err, 'load_failed');
  }
}
