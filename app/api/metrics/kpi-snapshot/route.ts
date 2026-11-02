import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { getKpiSnapshot } from '@/db/repositories/kpi-snapshots';
import { previousMonthEnd } from '@/lib/metrics/analytics-kpis';

/**
 * GET /api/metrics/kpi-snapshot — last month-end's Analytics tile values for the caller's own
 * scope (S-618): the firm for super admin and admin, the caller's own engagements for a
 * manager or a lead. `values` is empty when no snapshot was stored for that month.
 */
export async function GET() {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const period = previousMonthEnd(new Date());
  const values = await getKpiSnapshot(guard.ctx, period);
  return NextResponse.json({ period, values });
}
