import { NextResponse } from 'next/server';
import { requireAdminOrManager } from '@/auth/guards';
import { getAnnouncementSourceForWrite } from '@/db/repositories/announcements';
import { ingestAnnouncementSource } from '@/jobs/announcement-feeds';

/** POST /api/announcements/sources/[id]/fetch — pull the feed now. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminOrManager();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id } = await context.params;
  const source = await getAnnouncementSourceForWrite(guard.ctx, id);
  if (!source) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const ingest = await ingestAnnouncementSource(source);
  return NextResponse.json({ ingest });
}
