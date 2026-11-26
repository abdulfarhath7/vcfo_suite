import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { requestConsentOtp } from '@/lib/gstzen/otp';
import { GSTZEN_STAFF_ROLES, gstzenErrorResponse } from '@/lib/gstzen/route-errors';

const bodySchema = z.object({
  engagementId: z.string().min(1).max(100),
  audience: z.enum(['staff', 'client']),
  /** Typed only when Suite holds no GST portal username; used for this call and not stored. */
  username: z.string().max(60).optional().nullable(),
  runId: z.string().uuid().optional().nullable(),
});

/**
 * POST /api/gstzen/consent — ask the GST portal (through GSTZen) for the taxpayer's consent OTP and
 * open the "Your turn" request for staff or the client. Staff only. 503 when the GSTZen route is
 * closed; 200 with `needsUsername` when Suite holds no GST portal username.
 */
export async function POST(request: Request) {
  const guard = await requireAnyRole(...GSTZEN_STAFF_ROLES);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const out = await requestConsentOtp(guard.ctx, body.data);
    if (out.ok === false) return NextResponse.json({ needsUsername: true, message: out.message });
    return NextResponse.json({ request: out.request });
  } catch (err) {
    return gstzenErrorResponse(err);
  }
}
