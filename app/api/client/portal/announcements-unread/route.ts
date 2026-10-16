import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { countUnreadAnnouncements } from '@/db/repositories/announcement-reads';

/** GET /api/client/portal/announcements-unread — the top bar's gold dot. */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  return NextResponse.json({ unread: await countUnreadAnnouncements(guard.ctx) });
}
