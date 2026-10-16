import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { requestCredentialOtp } from '@/db/repositories/credentials';
import { parseJsonBody } from '@/lib/api/parse-body';
import { credentialsError, engagementParam } from '../_respond';

const body = z.object({
  mode: z.enum(['preview', 'edit', 'reveal']),
  scope: z.string().min(1).max(240),
});

/** POST /api/client/credentials/otp — send a 6-digit code to the Project Manager. */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const parsed = await parseJsonBody(request, body);
  if (parsed.ok === false) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    const ticket = await requestCredentialOtp(guard.ctx, { ...parsed.data, engagementId: engagementParam(request) });
    return NextResponse.json({ ok: true, ticket });
  } catch (e) {
    return credentialsError(e);
  }
}
