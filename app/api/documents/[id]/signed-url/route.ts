import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api/require-role';
import { documentIdParamSchema } from '@/lib/api/schemas';
import { getDocumentById } from '@/db/repositories/documents';
import { ENGAGEMENT_DOCUMENTS_BUCKET } from '@/lib/board-resolution-storage';
import {
  isMilestoneStoragePath,
  MILESTONE_DOCUMENTS_BUCKET,
} from '@/lib/milestone-document-storage';
import { bucketKey, signedDownloadUrl, type StorageBucket } from '@/storage/s3';

type RouteContext = { params: Promise<{ id: string }> };

function storageBucketAndPath(objectKey: string): { bucket: StorageBucket; path: string } {
  const clean = objectKey.replace(/^\/+/, '');
  if (clean.startsWith(`${MILESTONE_DOCUMENTS_BUCKET}/`)) {
    return {
      bucket: MILESTONE_DOCUMENTS_BUCKET,
      path: clean.slice(MILESTONE_DOCUMENTS_BUCKET.length + 1),
    };
  }
  if (clean.startsWith(`${ENGAGEMENT_DOCUMENTS_BUCKET}/`)) {
    return {
      bucket: ENGAGEMENT_DOCUMENTS_BUCKET,
      path: clean.slice(ENGAGEMENT_DOCUMENTS_BUCKET.length + 1),
    };
  }
  if (isMilestoneStoragePath(clean)) {
    return { bucket: MILESTONE_DOCUMENTS_BUCKET, path: clean };
  }
  return { bucket: ENGAGEMENT_DOCUMENTS_BUCKET, path: clean };
}

/**
 * GET /api/documents/:id/signed-url
 * Short-lived download URL for a documents-table row the caller can access.
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireRole(['admin', 'manager', 'intern', 'client']);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const parsed = documentIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  const doc = await getDocumentById(auth.ctx, parsed.data.id);
  if (!doc) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const { bucket, path } = storageBucketAndPath(doc.objectKey);
  if (!path) {
    return NextResponse.json({ ok: false, error: 'invalid_path' }, { status: 400 });
  }

  try {
    const url = await signedDownloadUrl(bucketKey(bucket, path), 3600);
    return NextResponse.json({ ok: true, url, fileName: doc.fileName });
  } catch {
    return NextResponse.json({ ok: false, error: 'signed_url_failed' }, { status: 500 });
  }
}
