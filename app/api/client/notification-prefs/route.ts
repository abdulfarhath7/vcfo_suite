import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { getOwnNotificationPrefs, updateOwnNotificationPrefs } from '@/db/repositories/notification-prefs';
import { normalizeNotificationPrefsPatch } from '@/lib/client-portal/notification-prefs';

/** GET /api/client/notification-prefs — the caller's own preference matrix. */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  return NextResponse.json({ prefs: await getOwnNotificationPrefs(guard.ctx) });
}

/** PATCH /api/client/notification-prefs — partial; locked email categories cannot be switched off. */
export async function PATCH(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const prefs = await updateOwnNotificationPrefs(guard.ctx, normalizeNotificationPrefsPatch(json));
  return NextResponse.json({ prefs });
}
