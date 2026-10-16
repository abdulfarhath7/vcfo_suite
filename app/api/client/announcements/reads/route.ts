import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import {
  listReadAnnouncementIds,
  markAnnouncementUnread,
  markAnnouncementsRead,
} from '@/db/repositories/announcement-reads';

/**
 * GET  /api/client/announcements/reads — ids the caller has opened.
 * POST /api/client/announcements/reads — { action: 'read', ids } | { action: 'unread', id }
 *      | { action: 'all', ids } (mark every listed id read).
 * Read marks are the caller's own (`announcement-reads.ts`, keyed by ctx.userId).
 */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const ids = await listReadAnnouncementIds(guard.ctx);
  return NextResponse.json({ readIds: [...ids] });
}

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('read'), ids: z.array(z.string().uuid()).min(1).max(200) }),
  z.object({ action: z.literal('all'), ids: z.array(z.string().uuid()).max(200) }),
  z.object({ action: z.literal('unread'), id: z.string().uuid() }),
]);

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  if (body.data.action === 'unread') {
    await markAnnouncementUnread(guard.ctx, body.data.id);
    return NextResponse.json({ ok: true });
  }
  const n = await markAnnouncementsRead(guard.ctx, body.data.ids);
  return NextResponse.json({ ok: true, marked: n });
}
