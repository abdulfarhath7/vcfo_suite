import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api/require-role';
import { createDocumentBodySchema } from '@/lib/api/schemas';
import { parseJsonBody } from '@/lib/api/validate';
import { createDocument, listDocuments } from '@/db/repositories/documents';

/**
 * GET /api/documents?engagementId=…
 * POST /api/documents — register an index row for an already-uploaded object.
 *
 * Milestone binary upload/download still goes through
 * `/api/engagements/.../milestone-documents` and
 * `/api/milestone-documents/signed-url` (see milestone-document-storage.ts).
 * This route is the optional documents-table index.
 */
export async function GET(request: Request) {
  const auth = await requireRole(['admin', 'manager', 'intern', 'client']);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const engagementId =
    new URL(request.url).searchParams.get('engagementId')?.trim() || undefined;

  try {
    const docs = await listDocuments(auth.ctx, engagementId);
    return NextResponse.json({ ok: true, documents: docs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'fetch_failed';
    return NextResponse.json(
      {
        ok: false,
        error: 'fetch_failed',
        detail: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireRole(['admin', 'manager', 'intern']);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const parsed = await parseJsonBody(request, createDocumentBodySchema);
  if (parsed.ok === false) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.status });
  }

  try {
    const doc = await createDocument(auth.ctx, parsed.data);
    return NextResponse.json({ ok: true, document: doc }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'save_failed';
    if (message.includes('not permitted') || message.includes('not found')) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      {
        ok: false,
        error: 'save_failed',
        detail: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 },
    );
  }
}
