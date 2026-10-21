import { NextResponse } from 'next/server';
import { rejectLargeBody } from '@/lib/api/body-limit';
import { requireAuth } from '@/auth/guards';
import { needUploadTarget, recordNeedUpload, undoNeedUpload } from '@/db/repositories/client-home';
import { bucketKey, deleteObject, putObject } from '@/storage/s3';

type RouteContext = { params: Promise<{ id: string }> };

const MAX_BYTES = 10 * 1024 * 1024; // "PDF, JPG or PNG · up to 10 MB"
const ALLOWED = /^(application\/pdf|image\/(jpeg|png))$/;

/**
 * POST /api/client/home/needs/[id]/upload (multipart, field `file`) — the
 * client uploads a file against an OPEN request (DECISIONS: uploads only
 * against open requests). Stored under `engagement-documents/<engagementId>/
 * requests/<requestId>/<ts>-<name>`, indexed in `documents` (shared with the
 * client) and the request is marked fulfilled.
 *
 * DELETE ?documentId= — Undo: reopen the request and remove the caller's own
 * upload.
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id } = await context.params;
  let target;
  try {
    target = await needUploadTarget(guard.ctx, id);
  } catch {
    return NextResponse.json({ error: 'This request is already closed' }, { status: 409 });
  }
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const tooLarge = rejectLargeBody(request, 25 * 1024 * 1024);
  if (tooLarge) return tooLarge;
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a file to upload' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Files can be up to 10 MB' }, { status: 413 });
  const type = file.type || 'application/octet-stream';
  if (!ALLOWED.test(type)) return NextResponse.json({ error: 'Upload a PDF, JPG or PNG' }, { status: 415 });

  const safe = file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'upload';
  const path = `${target.dbId}/requests/${id}/${Date.now()}-${safe}`;
  const objectKey = bucketKey('engagement-documents', path);
  await putObject(objectKey, Buffer.from(await file.arrayBuffer()), type);
  try {
    const saved = await recordNeedUpload(guard.ctx, id, {
      objectKey,
      fileName: file.name,
      contentType: type,
      sizeBytes: file.size,
    });
    if (!saved) {
      await deleteObject(objectKey).catch(() => undefined);
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...saved }, { status: 201 });
  } catch (err) {
    await deleteObject(objectKey).catch(() => undefined);
    const message = err instanceof Error ? err.message : 'upload_failed';
    return NextResponse.json({ error: message === 'request_closed' ? 'This request is already closed' : 'upload_failed' }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id } = await context.params;
  const documentId = new URL(request.url).searchParams.get('documentId')?.trim();
  if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 });
  const undone = await undoNeedUpload(guard.ctx, id, documentId);
  if (!undone) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await deleteObject(undone.objectKey).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
