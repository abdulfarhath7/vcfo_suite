import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { NocAccessError, nocFileKey } from '@/db/repositories/registered-office-noc';
import { DOCX_CONTENT_TYPE } from '@/lib/registered-office-noc/docx';
import { EXTENSION_TO_MIME } from '@/lib/upload-limits';
import { bucketKey, getObjectBuffer } from '@/storage/s3';

type RouteContext = { params: Promise<{ id: string }> };

function contentTypeFor(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'docx') return DOCX_CONTENT_TYPE;
  return (EXTENSION_TO_MIME as Record<string, string>)[ext] ?? 'application/octet-stream';
}

/**
 * GET /api/engagements/:id/registered-office-noc/file?kind=generated|signed —
 * the generated Word file or the signed copy, as a download. Staff with access.
 */
export async function GET(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const kind = new URL(request.url).searchParams.get('kind') === 'signed' ? 'signed' : 'generated';
  try {
    const file = await nocFileKey(guard.ctx, id, kind);
    if (!file) return NextResponse.json({ error: 'No file yet' }, { status: 404 });
    const bytes = await getObjectBuffer(bucketKey('engagement-documents', file.key));
    if (!bytes) return NextResponse.json({ error: 'The file is missing from storage' }, { status: 404 });
    const ascii = file.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': contentTypeFor(file.fileName),
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    if (err instanceof NocAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : 'download_failed' }, { status: 500 });
  }
}
