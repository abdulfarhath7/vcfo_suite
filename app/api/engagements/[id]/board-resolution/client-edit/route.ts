import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { publicErrorMessage } from '@/lib/api-error';
import { actOnClientEdit, clientEditContent, getClientEditView, saveClientEdit } from '@/lib/board-resolution/client-edit-flow';
import { patchBoardResolutionDocxBuffer, sanitizeBoardResolutionDocxBuffer } from '@/lib/board-resolution/board-resolution-docx';
import { standardDownloadName } from '@/lib/files/download-name';
import { downloadBoardResolutionDocx } from '@/storage/board-resolution';

/*
 * BR-04 / BR-05: the client's edit of the board resolution. GET reads it (with `?download=1`,
 * the client's version as a Word file), PUT saves the paragraphs, POST makes one workflow move.
 * The repository rules decide who may do what; this only parses and answers.
 */

type RouteContext = { params: Promise<{ id: string }> };

const ROLES = ['super_admin', 'admin', 'manager', 'intern', 'client'] as const;

const FRIENDLY: Record<string, string> = {
  not_with_client: 'You can edit the draft only while it is with you.',
  not_your_move: 'This step is not yours to take.',
  wrong_stage: 'The board resolution has moved on. Refresh the page.',
  return_needs_reason: 'Add the reason for the return.',
  no_client_edit: 'There is no edited version yet.',
};

function fail(err: unknown) {
  const message = publicErrorMessage(err, 'client_edit_failed');
  const status = message in FRIENDLY ? 409 : /not permitted|not found/i.test(message) ? 404 : 400;
  return NextResponse.json({ error: FRIENDLY[message] ?? message, code: message }, { status });
}

export async function GET(request: Request, context: RouteContext) {
  const guard = await requireAnyRole(...ROLES);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  try {
    if (new URL(request.url).searchParams.get('download') === '1') {
      const edit = await clientEditContent(guard.ctx, id);
      const bytes = edit ? await downloadBoardResolutionDocx(edit.storagePath) : null;
      if (!edit || !bytes) return NextResponse.json({ error: 'There is no edited version yet.' }, { status: 404 });
      const docx = sanitizeBoardResolutionDocxBuffer(patchBoardResolutionDocxBuffer(Buffer.from(bytes), edit.content));
      return new NextResponse(new Uint8Array(docx), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${standardDownloadName('Board-Resolution-Edited', null, 'docx')}"`,
        },
      });
    }
    return NextResponse.json({ view: await getClientEditView(guard.ctx, id) });
  } catch (err) {
    return fail(err);
  }
}

const SaveBody = z.object({ paragraphs: z.array(z.string().max(5000)).max(400) });

export async function PUT(request: Request, context: RouteContext) {
  const guard = await requireAnyRole(...ROLES);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, SaveBody);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  const { id } = await context.params;
  try {
    return NextResponse.json({ view: await saveClientEdit(guard.ctx, id, body.data.paragraphs) });
  } catch (err) {
    return fail(err);
  }
}

const ActBody = z.object({
  action: z.enum(['confirm', 'send', 'receive', 'manager-approve', 'admin-approve', 'return', 'resubmit', 'send-final']),
  note: z.string().max(2000).optional().nullable(),
});

export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole(...ROLES);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, ActBody);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  const { id } = await context.params;
  try {
    return NextResponse.json({ view: await actOnClientEdit(guard.ctx, id, body.data.action, body.data.note) });
  } catch (err) {
    return fail(err);
  }
}
