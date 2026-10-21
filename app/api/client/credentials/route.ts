import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { getCredentials } from '@/db/repositories/credentials';
import { credentialsError, engagementParam } from './_respond';

/**
 * GET /api/client/credentials — the credentials workbook (5 sheets + ID tiles).
 * Secret cells come back masked (`v: null, has: true`) unless the caller holds
 * a live manager-approved grant covering them (Path A in the repository).
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  try {
    const credentials = await getCredentials(guard.ctx, engagementParam(request));
    return NextResponse.json({ ok: true, credentials }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    return credentialsError(e);
  }
}
