import { NextResponse } from 'next/server';

import { assertEngagementBoardResolutionAccess } from '@/lib/api/board-resolution-access';
import { requireRole } from '@/lib/api/require-role';
import { checklist } from '@/data/checklist';
import { extractItemResponses } from '@/lib/checklist-responses';
import { normalizeChecklistItemSlice } from '@/lib/checklist-state-key';
import { incorpDocDownloadFilename } from '@/lib/incorporation-docs/paths';
import { isIncorpDraftSharedWithClient } from '@/lib/incorporation-docs/share';
import { sanitizeIncorpDocxBufferWithReport } from '@/lib/incorporation-docs/docx-sanitize';
import {
  downloadIncorpDocx,
  repairIncorpDocxAtPath,
} from '@/lib/incorporation-docs/storage';
import type { IncorpDocAudience } from '@/lib/incorporation-docs/shared';
import {
  draftUrlFieldFor,
  INCORP_DOC_DEFINITIONS,
  INCORP_DOC_KINDS,
  type IncorpDocKind,
} from '@/lib/incorporation-docs/types';
import { checklistStateFromRow } from '@/db/repositories/engagements';

type RouteContext = { params: Promise<{ id: string }> };

const VALID_AUDIENCES = new Set<IncorpDocAudience>(['non-resident', 'resident', 'company']);
const VALID_DOCS = new Set<string>(INCORP_DOC_KINDS);

function parseDirectorParam(value: string | null): IncorpDocAudience | null {
  if (!value || !VALID_AUDIENCES.has(value as IncorpDocAudience)) return null;
  return value as IncorpDocAudience;
}

function parseDocParam(value: string | null): IncorpDocKind | null {
  if (!value || !VALID_DOCS.has(value)) return null;
  return value as IncorpDocKind;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireRole(['admin', 'manager', 'intern', 'client']);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id: engagementParam } = await context.params;
  const url = new URL(request.url);
  const doc = parseDocParam(url.searchParams.get('doc'));
  const director = parseDirectorParam(url.searchParams.get('director'));

  if (!doc) {
    return NextResponse.json(
      { ok: false, error: 'Query param doc is required (see INCORP_DOC_KINDS).' },
      { status: 400 },
    );
  }

  if (!director) {
    return NextResponse.json(
      { ok: false, error: 'Query param director=non-resident|resident|company is required.' },
      { status: 400 },
    );
  }

  const fieldId = draftUrlFieldFor(doc, director);
  if (!fieldId) {
    return NextResponse.json(
      {
        ok: false,
        error: `${INCORP_DOC_DEFINITIONS[doc].label} is not applicable for this audience.`,
        code: 'not_applicable',
      },
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
  const pre7State = normalizeChecklistItemSlice(checklistState['pre-7'], 'pre-7');

  if (
    auth.ctx.role === 'client' &&
    !isIncorpDraftSharedWithClient(pre7State, doc, director as IncorpDocAudience)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Draft documents are not available until your project lead shares them.',
      },
      { status: 403 },
    );
  }

  const pre7Item = checklist.find((c) => c.id === 'pre-7');
  const pre7 = pre7Item ? extractItemResponses(pre7Item, pre7State) : {};

  const pre6Item = checklist.find((c) => c.id === 'pre-6');
  const pre6State = normalizeChecklistItemSlice(checklistState['pre-6'], 'pre-6');
  const pre6 = pre6Item ? extractItemResponses(pre6Item, pre6State) : {};

  const storagePath = (pre7[fieldId] ?? '').trim();
  if (!storagePath) {
    return NextResponse.json(
      {
        ok: false,
        error: `${INCORP_DOC_DEFINITIONS[doc].label} has not been generated yet.`,
        code: 'not_found',
      },
      { status: 404 },
    );
  }

  const bytes = await downloadIncorpDocx(storagePath);
  if (!bytes) {
    return NextResponse.json(
      { ok: false, error: 'The document file could not be downloaded.', code: 'download_failed' },
      { status: 404 },
    );
  }

  const filename = incorpDocDownloadFilename(doc, director, { pre6 });
  const sanitized = sanitizeIncorpDocxBufferWithReport(Buffer.from(bytes));
  if (sanitized.changed) {
    await repairIncorpDocxAtPath(storagePath, sanitized.buffer);
  }

  return new NextResponse(new Uint8Array(sanitized.buffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
