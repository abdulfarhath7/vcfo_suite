import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api/require-role';
import { knowledgeBankRegisterBodySchema } from '@/lib/api/schemas';
import { parseJsonBody } from '@/lib/api/validate';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  listKnowledgeBankFiles,
  registerKnowledgeBankFile,
} from '@/db/repositories/knowledge-bank';
import { isKnowledgeBankStoragePath } from '@/lib/knowledge-bank-storage';
import { bucketKey, deleteObject } from '@/storage/s3';

export async function GET() {
  const auth = await requireRole(['admin', 'manager', 'intern']);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  try {
    const files = await listKnowledgeBankFiles(auth.ctx, 200);
    return NextResponse.json({ ok: true, files });
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

  const parsed = await parseJsonBody(request, knowledgeBankRegisterBodySchema);
  if (parsed.ok === false) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.status });
  }

  const body = parsed.data;
  if (!isKnowledgeBankStoragePath(body.id, body.storagePath)) {
    return NextResponse.json({ ok: false, error: 'invalid_storage_path' }, { status: 400 });
  }

  const storagePath = body.storagePath.trim();

  try {
    const file = await registerKnowledgeBankFile(auth.ctx, {
      id: body.id,
      title: body.title,
      description: body.description?.trim() || null,
      storagePath,
      fileName: body.fileName,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    });

    await recordAuditEvent(auth.ctx, {
      action: 'knowledge_bank.upload',
      summary: `Uploaded "${body.title}" to Knowledge Bank`,
      metadata: { fileId: body.id, fileName: body.fileName },
      actorEmail: auth.ctx.email,
      actorName: auth.ctx.name,
    });

    return NextResponse.json({ ok: true, file }, { status: 201 });
  } catch {
    try {
      await deleteObject(bucketKey('knowledge-bank', storagePath));
    } catch {
      /* best-effort cleanup */
    }
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 500 });
  }
}
