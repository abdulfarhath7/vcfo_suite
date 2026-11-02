import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { getLeadHoursThisWeek } from '@/db/repositories/lead-hours';

/**
 * GET /api/metrics/lead-hours — hours each project lead planned this India week, from their
 * planner blocks (Analytics Workload, F-163): `{ weekStart, leads: [{ profileId, internId, name,
 * hours }] }`. Admin and super admin: every lead. Manager: the leads who report to them.
 */
export async function GET() {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const result = await getLeadHoursThisWeek(guard.ctx);
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}
