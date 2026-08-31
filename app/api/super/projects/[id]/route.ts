import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/auth/guards';
import { getSuperEngagementDetail } from '@/db/repositories/super-overview';

/**
 * GET /api/super/projects/[id] — one engagement, in full, for the super admin
 * detail screen.
 *
 * The repository runs `assertEngagementAccess` under the caller's context, so
 * an id the caller may not see comes back as 404 rather than a 403 that would
 * confirm the row exists. Read-only.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireSuperAdmin();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  const detail = await getSuperEngagementDetail(guard.ctx, id);

  if (!detail) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({ detail });
}
