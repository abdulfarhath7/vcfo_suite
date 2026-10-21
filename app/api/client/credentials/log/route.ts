import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { listCredentialsLog } from '@/db/repositories/credentials';
import { credentialsError, engagementParam } from '../_respond';

/** GET /api/client/credentials/log — the Access log drawer (credentials.* audit events, newest first). */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  try {
    const entries = await listCredentialsLog(guard.ctx, engagementParam(request));
    return NextResponse.json({ ok: true, entries }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    return credentialsError(e);
  }
}
