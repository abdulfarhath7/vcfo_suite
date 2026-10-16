import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import {
  ClientPortalForbiddenError,
  getPortalPrefs,
  updatePortalPrefs,
} from '@/db/repositories/client-portal';
import { normalizePortalPrefsPatch } from '@/lib/client-portal/types';

/** GET / PATCH /api/client/portal/prefs — the signed-in client's own portal preferences. */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    return NextResponse.json({ prefs: await getPortalPrefs(guard.ctx) });
  } catch (e) {
    if (e instanceof ClientPortalForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}

export async function PATCH(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await request.json().catch(() => null);
  try {
    return NextResponse.json({ prefs: await updatePortalPrefs(guard.ctx, normalizePortalPrefsPatch(body)) });
  } catch (e) {
    if (e instanceof ClientPortalForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
