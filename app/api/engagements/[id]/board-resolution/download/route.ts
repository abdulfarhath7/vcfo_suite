import { NextResponse } from 'next/server';
import {
  assertEngagementBoardResolutionAccess,
  fetchBoardResolutionForApi,
} from '@/lib/api/board-resolution-access';
import { boardResolutionAuthErrorResponse } from '@/lib/api/board-resolution-errors';
import { sanitizeBoardResolutionDocxBuffer } from '@/lib/board-resolution-docx';
import { requireRole } from '@/lib/api/require-role';
import { BOARD_RESOLUTION_DOCX_FILENAME } from '@/lib/board-resolution-storage';
import { downloadBoardResolutionDocx } from '@/storage/board-resolution';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireRole(['admin', 'manager', 'intern', 'client']);
  if (auth.ok === false) {
    return NextResponse.json(boardResolutionAuthErrorResponse(auth.error, auth.status), {
      status: auth.status,
    });
  }

  const { id: engagementParam } = await context.params;

  const access = await assertEngagementBoardResolutionAccess(auth.ctx, engagementParam);
  if (access.notFound) {
    return NextResponse.json(boardResolutionAuthErrorResponse('not_found', 404), { status: 404 });
  }
  if (access.forbidden) {
    return NextResponse.json(boardResolutionAuthErrorResponse('forbidden', 403), { status: 403 });
  }

  let doc;
  try {
    doc = await fetchBoardResolutionForApi(auth.ctx, access.dbId);
  } catch {
    return NextResponse.json({ ok: false, error: 'load_failed' }, { status: 500 });
  }

  if (!doc) {
    return NextResponse.json(
      {
        ok: false,
        error: 'No board resolution has been generated for this project yet.',
        code: 'not_found',
      },
      { status: 404 },
    );
  }

  if (auth.ctx.role === 'client' && doc.status !== 'finalized') {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Your board resolution is not available yet — your SBC team will release it after finalization.',
        code: 'forbidden',
      },
      { status: 403 },
    );
  }

  const storagePath = doc.storagePath?.trim();
  if (!storagePath) {
    return NextResponse.json(
      {
        ok: false,
        error: 'The Word document has not been generated yet.',
        code: 'no_docx',
      },
      { status: 404 },
    );
  }

  const bytes = await downloadBoardResolutionDocx(storagePath);
  if (!bytes) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'The board resolution file could not be downloaded. Ask your SBC team to re-generate it.',
        code: 'download_failed',
      },
      { status: 404 },
    );
  }

  const cleaned = sanitizeBoardResolutionDocxBuffer(Buffer.from(bytes));

  return new NextResponse(new Uint8Array(cleaned), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${BOARD_RESOLUTION_DOCX_FILENAME}"`,
      'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
