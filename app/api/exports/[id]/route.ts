import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { exportFileForOwner } from '@/db/repositories/export-files';
import { EXPORT_CONTENT_TYPES } from '@/lib/exports/record-export';
import { getObjectBuffer } from '@/storage/s3';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/exports/[id]: download one's own background export (GL-06, PR-02) while it is kept. */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const hit = await exportFileForOwner(guard.ctx, id);
  const bytes = hit ? await getObjectBuffer(hit.key) : null;
  if (!hit || !bytes) {
    return NextResponse.json({ error: 'This file is no longer available. Make the export again.' }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': EXPORT_CONTENT_TYPES[hit.format] ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${hit.fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
