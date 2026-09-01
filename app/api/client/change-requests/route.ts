import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { createClientChangeRequest } from '@/db/repositories/client-change-requests';

/**
 * POST /api/client/change-requests — the client asks the firm to change
 * something on a checklist step.
 *
 * This is the client's only write against the engagement's work surface, and it
 * writes a task, never `checklist_state`. The repository runs
 * `assertEngagementAccess`, so a request naming an engagement the caller cannot
 * see comes back 404 rather than a 403 that would confirm it exists.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: { engagementId?: string; stepId?: string; note?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { engagementId, stepId, note } = body;
  if (!engagementId?.trim() || !stepId?.trim() || !note?.trim()) {
    return NextResponse.json({ error: 'Tell us what you would like changed' }, { status: 400 });
  }

  try {
    const created = await createClientChangeRequest(guard.ctx, {
      engagementId: engagementId.trim(),
      stepId: stepId.trim(),
      note,
    });
    if (!created) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send the request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
