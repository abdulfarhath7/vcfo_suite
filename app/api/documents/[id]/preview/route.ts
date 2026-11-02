import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { documentIdParamSchema } from '@/lib/api/schemas';
import { resolveVaultFile } from '@/db/repositories/documents';
import { previewResponse } from '../../_lib/object-response';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/documents/:id/preview — the file itself, same origin, `Content-Disposition: inline`,
 * for the vault preview pane (G-26). Same roles and scope as `/api/documents/:id/signed-url`
 * (`getDocumentById`, so a client reads only shared rows). PDFs and images only (415 otherwise);
 * `?download=1` sends any type as an attachment instead.
 */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAnyRole('admin', 'manager', 'intern', 'client');
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const parsed = documentIdParamSchema.safeParse(await context.params);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }
  const file = await resolveVaultFile(auth.ctx, { documentId: parsed.data.id });
  if (!file) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  return previewResponse(file, { download: new URL(request.url).searchParams.get('download') === '1' });
}
