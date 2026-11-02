import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { getAnalyticsMetrics } from '@/db/repositories/metrics';

const querySchema = z.object({ months: z.enum(['6', '12']).default('6') });

/**
 * GET /api/metrics/analytics?months=6|12 — completion rate, filing delay, filings on time and
 * time in step (G-27). Staff, each over their own engagement scope.
 */
export async function GET(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const url = new URL(request.url);
  const query = querySchema.safeParse({ months: url.searchParams.get('months') ?? undefined });
  if (!query.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }
  const analytics = await getAnalyticsMetrics(guard.ctx, { months: Number(query.data.months) });
  if (!analytics) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json({ analytics });
}
