import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import {
  isMilestoneStoragePath,
  MILESTONE_DOCUMENTS_BUCKET,
} from '@/lib/milestone-document-storage';
import { bucketKey, signedDownloadUrl } from '@/storage/s3';

/**
 * GET /api/milestone-documents/signed-url?path=&expiresIn=
 * Short-lived download URL for a milestone document the caller can access.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const url = new URL(request.url);
  const path = url.searchParams.get('path')?.trim() ?? '';
  const expiresRaw = Number.parseInt(url.searchParams.get('expiresIn') ?? '3600', 10);
  const expiresIn = Number.isFinite(expiresRaw)
    ? Math.min(Math.max(expiresRaw, 60), 3600)
    : 3600;

  if (!path || !isMilestoneStoragePath(path)) {
    return NextResponse.json({ ok: false, error: 'invalid_path' }, { status: 400 });
  }

  const engagementDbIdFromPath = path.split('/')[0] ?? '';
  if (!engagementDbIdFromPath) {
    return NextResponse.json({ ok: false, error: 'invalid_path' }, { status: 400 });
  }

  const access = await assertEngagementAccess(guard.ctx, engagementDbIdFromPath);
  if (!access.ok) {
    if ('notFound' in access && access.notFound) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const signed = await signedDownloadUrl(
      bucketKey(MILESTONE_DOCUMENTS_BUCKET, path),
      expiresIn,
    );
    return NextResponse.json({ url: signed });
  } catch {
    return NextResponse.json({ ok: false, error: 'signed_url_failed' }, { status: 500 });
  }
}
