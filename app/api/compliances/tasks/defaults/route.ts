import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { taskDefaults } from '@/db/repositories/compliance-tasks';
import { complianceError } from '../../_respond';

/** GET /api/compliances/tasks/defaults?engagementId= — the New task form's people and activities (S-5). */
export async function GET(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const engagementId = new URL(request.url).searchParams.get('engagementId')?.trim();
  if (!engagementId) return NextResponse.json({ error: 'engagement_required' }, { status: 400 });
  try {
    return NextResponse.json(await taskDefaults(guard.ctx, engagementId));
  } catch (e) {
    return complianceError(e);
  }
}
