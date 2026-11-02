import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { listActivities } from '@/db/repositories/compliance-activities';
import { complianceError } from '../_respond';

/**
 * GET /api/compliances/activities?group=statutory|non-statutory — the activity master (DR-01).
 * The `confirm` point is returned to admin and super admin only.
 */
export async function GET(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern', 'client');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const g = new URL(request.url).searchParams.get('group');
  const group = g === 'statutory' || g === 'non-statutory' ? g : undefined;
  try {
    return NextResponse.json({ activities: await listActivities(guard.ctx, { group }) });
  } catch (e) {
    return complianceError(e);
  }
}
