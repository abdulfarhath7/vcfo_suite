import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { ClientDocumentsForbiddenError, getClientDocuments } from '@/db/repositories/client-documents';

/**
 * GET /api/client/documents — every document the signed-in client may see,
 * merged from checklist uploads (+ earlier versions), shared index rows, the
 * finalized board resolution and document requests (open ones as "missing").
 */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const documents = await getClientDocuments(guard.ctx);
    if (!documents) return NextResponse.json({ error: 'No engagement found' }, { status: 404 });
    return NextResponse.json({ documents });
  } catch (e) {
    if (e instanceof ClientDocumentsForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    console.error('[client-documents] list failed', e);
    return NextResponse.json({ error: 'Could not load documents' }, { status: 500 });
  }
}
