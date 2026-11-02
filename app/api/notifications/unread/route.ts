import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { markNotificationsUnread } from '@/db/repositories/notifications-unread';

const bodySchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(80) });

/** POST /api/notifications/unread — { ids } back to unread (own rows only). */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const count = await markNotificationsUnread(guard.ctx, body.data.ids);
    return NextResponse.json({ count });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unread_failed' }, { status: 500 });
  }
}
