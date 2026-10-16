import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { verifyCredentialOtp } from '@/db/repositories/credentials';
import { parseJsonBody } from '@/lib/api/parse-body';
import { credentialsError } from '../../_respond';

const body = z.object({ otpId: z.string().uuid(), code: z.string().max(12) });

/**
 * POST /api/client/credentials/otp/verify — a right code opens a 10-minute
 * grant; wrong codes count down 3 tries, then lock for 60 s.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const parsed = await parseJsonBody(request, body);
  if (parsed.ok === false) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    const outcome = await verifyCredentialOtp(guard.ctx, parsed.data);
    return NextResponse.json(outcome, { status: outcome.ok === true ? 200 : outcome.error === 'locked' ? 423 : 400 });
  } catch (e) {
    return credentialsError(e);
  }
}
