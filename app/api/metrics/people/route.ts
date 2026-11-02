import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { getPeopleMetrics } from '@/db/repositories/metrics';

/**
 * GET /api/metrics/people — On time %, load against capacity and last active for the managers
 * and project leads the caller may see (G-14). Admin and super admin: everyone. Manager:
 * themselves and their leads.
 */
export async function GET() {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const people = await getPeopleMetrics(guard.ctx);
  return NextResponse.json({ people });
}
