import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { getPracticeMetrics } from '@/db/repositories/metrics';

/**
 * GET /api/metrics/practice — practice cards: stage splits, days in each stage, expected
 * certificates, days in the current step, registrations in progress against pending, and this
 * month's filings (G-13, G-29). Staff, each over their own engagement scope.
 */
export async function GET() {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const practice = await getPracticeMetrics(guard.ctx);
  if (!practice) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json({ practice });
}
