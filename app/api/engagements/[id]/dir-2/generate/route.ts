import { NextResponse } from 'next/server';
import { z } from 'zod';

import { assertEngagementBoardResolutionAccess } from '@/lib/api/board-resolution-access';
import { generateAndStoreDir2, Dir2Error, toDir2Error } from '@/lib/api/dir-2-generate';
import { parseJsonBody } from '@/lib/api/parse-body';
import { requireRole } from '@/lib/api/require-role';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import type { Dir2DirectorKind } from '@/lib/dir-2';
import {
  checklistStateFromRow,
  toAppEngagement,
} from '@/db/repositories/engagements';

type RouteContext = { params: Promise<{ id: string }> };

const generateBodySchema = z.object({
  directors: z
    .array(z.enum(['non-resident', 'resident']))
    .min(1)
    .optional(),
});

function dir2ErrorJson(err: Dir2Error) {
  return { ok: false as const, error: err.message, code: err.code };
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

  let directors: Dir2DirectorKind[] = ['non-resident', 'resident'];
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const parsedBody = await parseJsonBody(request, generateBodySchema);
    if (parsedBody.ok === false) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request.', code: 'validation_error' },
        { status: parsedBody.status },
      );
    }
    if (parsedBody.data.directors?.length) {
      directors = parsedBody.data.directors;
    }
  }

  try {
    const paths = await generateAndStoreDir2(
      auth.ctx,
      engagement,
      checklistState,
      directors,
    );

    await recordAuditEvent(auth.ctx, {
      engagementId: engagement.id,
      action: 'dir_2.generate',
      summary: 'Generated DIR-2 draft document(s)',
      actorEmail: auth.ctx.email,
      actorName: auth.ctx.name,
      metadata: { directors },
    });

    return NextResponse.json({
      ok: true,
      paths,
      downloadBase: `/api/engagements/${engagement.id}/dir-2/download`,
    });
  } catch (err) {
    const mapped = toDir2Error(err);
    return NextResponse.json(dir2ErrorJson(mapped), { status: mapped.status });
  }
}
