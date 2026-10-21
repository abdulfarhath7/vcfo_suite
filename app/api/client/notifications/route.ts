import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { listNotifications } from '@/db/repositories/notifications';
import {
  markAllNotificationsReadReturningIds,
  markNotificationsReadByIds,
  markNotificationsUnread,
} from '@/db/repositories/client-notifications';

/**
 * GET  /api/client/notifications — the caller's full history (inbox + cleared).
 * POST /api/client/notifications — { action: 'read', ids } | { action: 'unread', ids }
 *      | { action: 'read_all' } → { ids } changed (so Undo restores exactly those).
 * Own rows only (`client-notifications.ts` / `notifications.ts`).
 */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const notifications = await listNotifications(guard.ctx, { includeDismissed: true });
  return NextResponse.json({ notifications });
}

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('read'), ids: z.array(z.string()).min(1).max(500) }),
  z.object({ action: z.literal('unread'), ids: z.array(z.string()).min(1).max(500) }),
  z.object({ action: z.literal('read_all') }),
]);

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  const b = body.data;
  if (b.action === 'read') return NextResponse.json({ ids: await markNotificationsReadByIds(guard.ctx, b.ids) });
  if (b.action === 'unread') return NextResponse.json({ count: await markNotificationsUnread(guard.ctx, b.ids) });
  return NextResponse.json({ ids: await markAllNotificationsReadReturningIds(guard.ctx) });
}
