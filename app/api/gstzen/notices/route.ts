import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { listGstNotices } from '@/db/repositories/gst-notices';
import { GSTZEN_STAFF_ROLES, gstzenErrorResponse } from '@/lib/gstzen/route-errors';

/**
 * GET /api/gstzen/notices?engagementId= — the GST notices the daily watcher stored for the
 * engagement (no document bodies). Staff only. Stored data: no GSTZen call.
 */
export async function GET(request: Request) {
  const guard = await requireAnyRole(...GSTZEN_STAFF_ROLES);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const engagementId = new URL(request.url).searchParams.get('engagementId')?.trim();
  if (!engagementId) return NextResponse.json({ error: 'engagementId is required' }, { status: 400 });
  try {
    return NextResponse.json({ notices: await listGstNotices(guard.ctx, engagementId) });
  } catch (err) {
    return gstzenErrorResponse(err);
  }
}
