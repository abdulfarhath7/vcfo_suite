import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api/require-role';
import { isKnowledgeBankStoragePath } from '@/lib/knowledge-bank-storage';
import { bucketKey, deleteObject, signedDownloadUrl } from '@/storage/s3';

/** GET /api/knowledge-bank/signed-url?path=&expiresIn= — short-lived download URL. */
export async function GET(request: Request) {
  const auth = await requireRole(['admin', 'manager', 'intern']);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const path = url.searchParams.get('path')?.trim() ?? '';
  const expiresRaw = Number.parseInt(url.searchParams.get('expiresIn') ?? '3600', 10);
  const expiresIn = Number.isFinite(expiresRaw) ? Math.min(Math.max(expiresRaw, 60), 3600) : 3600;

  const fileId = path.split('/')[0] ?? '';
  if (!path || !isKnowledgeBankStoragePath(fileId, path)) {
    return NextResponse.json({ ok: false, error: 'invalid_path' }, { status: 400 });
  }

  try {
    const signed = await signedDownloadUrl(bucketKey('knowledge-bank', path), expiresIn);
    return NextResponse.json({ url: signed });
  } catch {
    return NextResponse.json({ ok: false, error: 'signed_url_failed' }, { status: 500 });
  }
}

/** DELETE /api/knowledge-bank/object?path= — remove orphaned upload. */
export async function DELETE(request: Request) {
  const auth = await requireRole(['admin', 'manager', 'intern']);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const path = url.searchParams.get('path')?.trim() ?? '';
  const fileId = path.split('/')[0] ?? '';
  if (!path || !isKnowledgeBankStoragePath(fileId, path)) {
    return NextResponse.json({ ok: false, error: 'invalid_path' }, { status: 400 });
  }

  try {
    await deleteObject(bucketKey('knowledge-bank', path));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'delete_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
