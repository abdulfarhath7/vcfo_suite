import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { createFileRequest, FileRequestError, listFileRequests } from '@/db/repositories/client-incorporation';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/engagements/:id/file-requests — file requests to the client (anyone with access). */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  try {
    return NextResponse.json({ requests: await listFileRequests(guard.ctx, id) });
  } catch (err) {
    if (err instanceof FileRequestError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

/**
 * POST /api/engagements/:id/file-requests — the firm asks the client for one
 * file field of one step. Body: { stepId, fieldId, label, note?, dueDate? }.
 * Staff only (repository).
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  let body: { stepId?: string; fieldId?: string; label?: string; note?: string; dueDate?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  try {
    const created = await createFileRequest(guard.ctx, id, {
      stepId: String(body.stepId ?? ''),
      fieldId: String(body.fieldId ?? ''),
      label: String(body.label ?? ''),
      note: body.note,
      dueDate: body.dueDate,
    });
    return NextResponse.json({ request: created }, { status: 201 });
  } catch (err) {
    if (err instanceof FileRequestError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
