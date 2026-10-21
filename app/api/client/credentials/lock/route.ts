import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { lockCredentialScope } from '@/db/repositories/credentials';
import { parseJsonBody } from '@/lib/api/parse-body';
import { credentialsError, engagementParam } from '../_respond';

const body = z.object({ scope: z.string().min(1).max(240) });

/** POST /api/client/credentials/lock — Lock / Hide: end the caller's grant on a scope early. */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const parsed = await parseJsonBody(request, body);
  if (parsed.ok === false) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    await lockCredentialScope(guard.ctx, { scope: parsed.data.scope, engagementId: engagementParam(request) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return credentialsError(e);
  }
}
