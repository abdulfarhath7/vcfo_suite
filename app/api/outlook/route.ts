import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { getOutlookStatus } from '@/db/repositories/outlook-connections';
import { outlookConfigured } from '@/lib/outlook/oauth';

/** GET /api/outlook — connection status for the signed-in staff user. */
export async function GET() {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  try {
    const status = await getOutlookStatus(guard.ctx);
    return NextResponse.json({
      configured: outlookConfigured(),
      ...status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'status_failed';
    const status = message.includes('not permitted') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
