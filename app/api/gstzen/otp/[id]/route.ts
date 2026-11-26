import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { answerOtpRequest } from '@/lib/gstzen/otp';
import { GSTZEN_STAFF_ROLES, gstzenErrorResponse } from '@/lib/gstzen/route-errors';

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({ otp: z.string().regex(/^\d{6}$/, 'The OTP is six digits.') });

/**
 * POST /api/gstzen/otp/:id — a staff member types the consent or EVC OTP (the client may read it out
 * on a call). The OTP goes straight to GSTZen in this request and is never stored or logged. Staff
 * only; the client answers on /api/client/agent-otp/:id.
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole(...GSTZEN_STAFF_ROLES);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json(await answerOtpRequest(guard.ctx, id, body.data.otp));
  } catch (err) {
    return gstzenErrorResponse(err);
  }
}
