import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { listMyPendingOtpRequests } from '@/db/repositories/agent-otp';
import { gstzenErrorResponse } from '@/lib/gstzen/route-errors';

/**
 * GET /api/client/agent-otp — the client's "Your turn" OTP requests (MASTER-PLAN screen 8): open
 * requests addressed to the client on the client's own engagements. Clients only.
 */
export async function GET() {
  const guard = await requireRole('client');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    return NextResponse.json({ requests: await listMyPendingOtpRequests(guard.ctx) });
  } catch (err) {
    return gstzenErrorResponse(err);
  }
}
