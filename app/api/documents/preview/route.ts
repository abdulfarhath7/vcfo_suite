import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { resolveVaultFile } from '@/db/repositories/documents';
import { previewResponse } from '../_lib/object-response';

const querySchema = z.union([
  z.object({ path: z.string().trim().min(3).max(600), requestFileId: z.undefined() }),
  z.object({ requestFileId: z.string().uuid(), path: z.undefined() }),
]);

/**
 * GET /api/documents/preview?path=… | ?requestFileId=… — inline preview for vault files that
 * have no documents-table row: a checklist upload by its storage path (the checks of
 * `/api/milestone-documents/signed-url`: engagement access, then the step's release), or a file
 * sent against a document request (engagement access). PDFs and images only (415 otherwise);
 * `?download=1` sends any type as an attachment instead.
 */
export async function GET(request: Request) {
  const auth = await requireAnyRole('admin', 'manager', 'intern', 'client');
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    path: params.get('path') ?? undefined,
    requestFileId: params.get('requestFileId') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 });
  }
  const ref = parsed.data.path !== undefined ? { path: parsed.data.path } : { requestFileId: parsed.data.requestFileId! };
  const file = await resolveVaultFile(auth.ctx, ref);
  if (!file) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  return previewResponse(file, { download: params.get('download') === '1' });
}
