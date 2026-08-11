import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api/require-role';
import { knowledgeBankIdParamSchema } from '@/lib/api/schemas';
import {
  getKnowledgeBankFile,
  getKnowledgeBankStoragePath,
} from '@/db/repositories/knowledge-bank';
import { bucketKey, signedDownloadUrl } from '@/storage/s3';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireRole(['admin', 'manager', 'intern']);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const parsed = knowledgeBankIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  const row = await getKnowledgeBankFile(auth.ctx, parsed.data.id);
  if (!row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const storagePath = await getKnowledgeBankStoragePath(auth.ctx, parsed.data.id);
  if (!storagePath) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  try {
    const url = await signedDownloadUrl(bucketKey('knowledge-bank', storagePath), 3600);
    return NextResponse.json({
      ok: true,
      id: row.id,
      title: row.title,
      fileName: row.fileName,
      url,
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'signed_url_failed' }, { status: 500 });
  }
}
