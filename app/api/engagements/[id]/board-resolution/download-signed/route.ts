import { NextResponse } from 'next/server';
import {
  assertEngagementBoardResolutionAccess,
  fetchBoardResolutionForApi,
} from '@/lib/api/board-resolution-access';
import { requireRole } from '@/lib/api/require-role';
import {
  contentTypeForSignedBoardResolutionPath,
  downloadFilenameForSignedBoardResolution,
} from '@/lib/board-resolution-storage';
import { downloadSignedBoardResolution } from '@/storage/board-resolution';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireRole(['admin', 'manager', 'intern', 'client']);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id: engagementParam } = await context.params;

  const access = await assertEngagementBoardResolutionAccess(auth.ctx, engagementParam);
  if (access.notFound) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  if (access.forbidden) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let doc;
  try {
    doc = await fetchBoardResolutionForApi(auth.ctx, access.dbId);
  } catch {
    return NextResponse.json({ ok: false, error: 'load_failed' }, { status: 500 });
  }

  if (!doc) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  if (auth.ctx.role === 'client' && doc.status !== 'finalized') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const storagePath = doc.signedStoragePath?.trim();
  if (!storagePath) {
    return NextResponse.json({ ok: false, error: 'no_signed_copy' }, { status: 404 });
  }

  const bytes = await downloadSignedBoardResolution(storagePath);
  if (!bytes) {
    return NextResponse.json({ ok: false, error: 'download_failed' }, { status: 404 });
  }

  const filename = downloadFilenameForSignedBoardResolution(storagePath);

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': contentTypeForSignedBoardResolutionPath(storagePath),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
