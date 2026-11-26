import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { getEngagementGstnSession } from '@/db/repositories/gstn-sessions';
import { gstzenGate } from '@/lib/gstzen/gate';
import { GSTZEN_STAFF_ROLES, gstzenErrorResponse } from '@/lib/gstzen/route-errors';

/**
 * GET /api/gstzen/status?engagementId= — whether the GSTZen route is open for the caller now, the
 * engagement's recorded GSTIN and its GSTN session (status and expiry only). Staff only. It never
 * calls GSTZen, so it answers 200 even when the route is closed, with `open: false` and the reason.
 */
export async function GET(request: Request) {
  const guard = await requireAnyRole(...GSTZEN_STAFF_ROLES);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const engagementId = new URL(request.url).searchParams.get('engagementId')?.trim();
  if (!engagementId) return NextResponse.json({ error: 'engagementId is required' }, { status: 400 });
  try {
    const [gate, s] = await Promise.all([gstzenGate(guard.ctx.userId), getEngagementGstnSession(guard.ctx, engagementId)]);
    return NextResponse.json({ open: gate.open, message: gate.open === false ? gate.message : null, gstin: s.gstin, session: s.session });
  } catch (err) {
    return gstzenErrorResponse(err);
  }
}
