import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { getTaskById } from '@/db/repositories/tasks';
import { HANDOFF_TASK_PREFIX, REVIEW_STATE_LABEL, reviewStateFromTaskStatus } from '@/lib/ask/ai-review';

/**
 * GET /api/ask/handoff/[id] — the status of a client's "Ask my lead" or "Ask my CA to confirm"
 * request, which is a task on the engagement's lead. Client only. `getTaskById` checks the
 * engagement is the caller's own; only hand-off tasks answer, and only their status leaves.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (guard.ctx.role !== 'client') return NextResponse.json({ error: 'Clients only' }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const task = await getTaskById(guard.ctx, id);
    if (!task || !task.title.startsWith(HANDOFF_TASK_PREFIX)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const state = reviewStateFromTaskStatus(task.status);
    return NextResponse.json({ state, label: REVIEW_STATE_LABEL[state] });
  } catch (error) {
    console.error('[ask-vcfo] handoff status failed', error);
    return NextResponse.json({ error: 'Could not check the status' }, { status: 500 });
  }
}
