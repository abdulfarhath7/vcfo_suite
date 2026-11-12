import { NextResponse } from 'next/server';

import { requireAnyRole } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  downloadContentType,
  isInlineType,
  loadDownloadCatalog,
  openDownloadFile,
  pickDownloadFiles,
} from '@/lib/document-downloads/bundle';
import { contentDisposition } from '../../../../documents/_lib/object-response';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/engagements/[id]/document-downloads/file?key=… — one document of the engagement, from
 * our own origin, for the shared preview (the eye icon). `?download=1` sends it as an attachment
 * and writes the audit event. Same staff roles and the same catalog as the download pop-up, so a
 * person previews only what they could download. PDFs and images are served inline; any other
 * type (Word, Excel) always goes as an attachment, and the viewer reads it as a blob.
 */
export async function GET(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const params = new URL(request.url).searchParams;
  const key = params.get('key')?.trim() ?? '';
  const download = params.get('download') === '1';
  if (!key) return NextResponse.json({ error: 'Choose a document.' }, { status: 400 });

  const result = await loadDownloadCatalog(guard.ctx, id);
  if (result.ok === false) return NextResponse.json({ error: result.error }, { status: result.status });
  const [picked] = pickDownloadFiles(result.loaded, [key]);
  if (!picked) return NextResponse.json({ error: 'This document is not ready yet.' }, { status: 404 });

  const { file } = picked;
  const bytes = await openDownloadFile(result.loaded, file);
  if (!bytes) return NextResponse.json({ error: `${file.label} could not be loaded.` }, { status: 404 });

  const type = downloadContentType(file.fileName);
  if (download) {
    await recordAuditEvent(guard.ctx, {
      engagementId: result.loaded.inputs.dbId,
      action: 'documents.download',
      summary: `Downloaded 1 document (${file.fileName})`,
      metadata: { fileName: file.fileName, mode: 'file', keys: [file.key] },
    });
  }
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': type,
      'Content-Disposition': contentDisposition(!download && isInlineType(type) ? 'inline' : 'attachment', file.fileName),
      'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
