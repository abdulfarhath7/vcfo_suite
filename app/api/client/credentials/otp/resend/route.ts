import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { resendCredentialOtp } from '@/db/repositories/credentials';
import { parseJsonBody } from '@/lib/api/parse-body';
import { credentialsError } from '../../_respond';

const body = z.object({ otpId: z.string().uuid() });

/** POST /api/client/credentials/otp/resend — new code to the manager (every 30 s, not while locked). */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const parsed = await parseJsonBody(request, body);
  if (parsed.ok === false) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    const ticket = await resendCredentialOtp(guard.ctx, parsed.data.otpId);
    return NextResponse.json({ ok: true, ticket });
  } catch (e) {
    return credentialsError(e);
  }
}
