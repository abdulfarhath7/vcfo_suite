import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { answerOtpRequest } from '@/lib/gstzen/otp';
import { gstzenErrorResponse } from '@/lib/gstzen/route-errors';

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({ otp: z.string().regex(/^\d{6}$/, 'The OTP is six digits.') });

/**
 * POST /api/client/agent-otp/:id — the client types the OTP the GST portal sent them. It goes
 * straight to GSTZen in this request; SBC never sees or keeps it. Clients only, and only for a
 * request addressed to the client on their own engagement.
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireRole('client');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const out = await answerOtpRequest(guard.ctx, id, body.data.otp);
    return NextResponse.json(out.purpose === 'evc' ? { purpose: out.purpose, arn: out.arn } : { purpose: out.purpose });
  } catch (err) {
    return gstzenErrorResponse(err);
  }
}
