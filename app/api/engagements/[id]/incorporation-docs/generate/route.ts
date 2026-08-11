import { NextResponse } from 'next/server';
import { z } from 'zod';

import { assertEngagementBoardResolutionAccess } from '@/lib/api/board-resolution-access';
import {
  generateAndStoreIncorpDocs,
  IncorpDocsError,
  parseIncorpDocKinds,
  toIncorpDocsError,
} from '@/lib/api/incorporation-docs-generate';
import { incorpDocsErrorJson } from '@/lib/api/incorporation-docs-errors';
import { parseJsonBody } from '@/lib/api/parse-body';
import { requireRole } from '@/lib/api/require-role';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { INCORP_DOC_KINDS } from '@/lib/incorporation-docs/types';
import {
  checklistStateFromRow,
  toAppEngagement,
} from '@/db/repositories/engagements';

type RouteContext = { params: Promise<{ id: string }> };

const generateBodySchema = z.object({
  docs: z.array(z.enum(INCORP_DOC_KINDS)).min(1).optional(),
  directors: z.array(z.enum(['non-resident', 'resident', 'company'])).min(1).optional(),
  content: z.string().min(1).optional(),
});

function incorpDocsErrorResponse(err: IncorpDocsError) {
  return incorpDocsErrorJson(err);
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireRole(['admin', 'manager', 'intern']);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id: engagementParam } = await context.params;

  const access = await assertEngagementBoardResolutionAccess(auth.ctx, engagementParam);
  if (access.notFound) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  if (access.forbidden || !access.row) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const engagement = toAppEngagement(access.row);
  const checklistState = checklistStateFromRow(access.row);

  let docs = [...INCORP_DOC_KINDS];
  let directors: ('non-resident' | 'resident' | 'company')[] | undefined;
  let editedContent: string | undefined;

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const parsedBody = await parseJsonBody(request, generateBodySchema);
    if (parsedBody.ok === false) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request.', code: 'validation_error' },
        { status: parsedBody.status },
      );
    }
    if (parsedBody.data.docs?.length) {
      docs = parseIncorpDocKinds(parsedBody.data.docs);
    }
    if (parsedBody.data.directors?.length) {
      directors = parsedBody.data.directors;
    }
    if (parsedBody.data.content?.trim()) {
      editedContent = parsedBody.data.content.trim();
    }
  }

  if (editedContent) {
    if (docs.length !== 1 || !directors?.length || directors.length !== 1) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Inline save requires exactly one doc and one director.',
          code: 'validation_error',
        },
        { status: 400 },
      );
    }
  }

  try {
    const { paths, responsePatch } = await generateAndStoreIncorpDocs(
      auth.ctx,
      engagement,
      checklistState,
      { docs, directors, content: editedContent },
    );

    await recordAuditEvent(auth.ctx, {
      engagementId: engagement.id,
      action: editedContent ? 'incorporation_docs.patch' : 'incorporation_docs.generate',
      summary: editedContent
        ? 'Saved inline edits to incorporation draft'
        : 'Generated incorporation draft document(s)',
      actorEmail: auth.ctx.email,
      actorName: auth.ctx.name,
      metadata: { docs, directors: directors ?? 'all' },
    });

    return NextResponse.json({
      ok: true,
      paths,
      responsePatch,
      downloadBase: `/api/engagements/${engagement.id}/incorporation-docs/download`,
    });
  } catch (err) {
    const mapped = toIncorpDocsError(err);
    return NextResponse.json(incorpDocsErrorResponse(mapped), { status: mapped.status });
  }
}
