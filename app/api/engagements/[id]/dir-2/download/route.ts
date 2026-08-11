import { NextResponse } from 'next/server';

import { assertEngagementBoardResolutionAccess } from '@/lib/api/board-resolution-access';
import { requireRole } from '@/lib/api/require-role';
import { checklist } from '@/data/checklist';
import { extractItemResponses } from '@/lib/checklist-responses';
import type { Dir2DirectorKind } from '@/lib/dir-2';
import { dir2DownloadFilename } from '@/lib/dir-2';
import { downloadDir2Docx } from '@/lib/dir-2-storage';
import { sanitizeIncorpDocxBufferWithReport } from '@/lib/incorporation-docs/docx-sanitize';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { repairIncorpDocxAtPath } from '@/lib/incorporation-docs/storage';
import { checklistStateFromRow } from '@/db/repositories/engagements';

type RouteContext = { params: Promise<{ id: string }> };

const VALID_DIRECTORS = new Set<Dir2DirectorKind>(['non-resident', 'resident']);

function parseDirectorParam(value: string | null): Dir2DirectorKind | null {
  if (!value || !VALID_DIRECTORS.has(value as Dir2DirectorKind)) return null;
  return value as Dir2DirectorKind;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireRole(['admin', 'manager', 'intern', 'client']);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id: engagementParam } = await context.params;
  const url = new URL(request.url);
  const director = parseDirectorParam(url.searchParams.get('director'));
  if (!director) {
    return NextResponse.json(
      { ok: false, error: 'Query param director=non-resident|resident is required.' },
      { status: 400 },
    );
  }

  const access = await assertEngagementBoardResolutionAccess(auth.ctx, engagementParam);
  if (access.notFound) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  if (access.forbidden || !access.row) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const checklistState = checklistStateFromRow(access.row);
  const pre7Item = checklist.find((c) => c.id === 'pre-7');
  const pre7State = checklistState['pre-7'] as ChecklistItemStateSlice | undefined;
  const pre7 = pre7Item ? extractItemResponses(pre7Item, pre7State) : {};

  const fieldId =
    director === 'non-resident' ? 'nrDirectorDir2DraftUrl' : 'residentDirectorDir2DraftUrl';
  const storagePath = (pre7[fieldId] ?? '').trim();

  if (!storagePath) {
    return NextResponse.json(
      { ok: false, error: 'DIR-2 has not been generated for this director yet.', code: 'not_found' },
      { status: 404 },
    );
  }

  const bytes = await downloadDir2Docx(storagePath);
  if (!bytes) {
    return NextResponse.json(
      { ok: false, error: 'The DIR-2 file could not be downloaded.', code: 'download_failed' },
      { status: 404 },
    );
  }

  const sanitized = sanitizeIncorpDocxBufferWithReport(Buffer.from(bytes));
  if (sanitized.changed) {
    await repairIncorpDocxAtPath(storagePath, sanitized.buffer);
  }

  return new NextResponse(new Uint8Array(sanitized.buffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${dir2DownloadFilename(director)}"`,
      'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
