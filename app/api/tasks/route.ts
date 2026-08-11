import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { createTask, listTasks } from '@/db/repositories/tasks';
import type { StatusCode } from '@/data/checklist';

/** GET /api/tasks — list tasks scoped by role. */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  try {
    const tasks = await listTasks(guard.ctx);
    return NextResponse.json({ tasks });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/tasks — create a task (manager/intern). */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  let body: {
    engagementId?: string;
    title?: string;
    checklistKey?: string;
    status?: StatusCode;
    assigneeId?: string | null;
    dueAt?: string | null;
    notes?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.engagementId?.trim()) {
    return NextResponse.json({ error: 'engagementId_required' }, { status: 400 });
  }
  try {
    const task = await createTask(guard.ctx, {
      engagementId: body.engagementId,
      title: body.title,
      checklistKey: body.checklistKey,
      status: body.status,
      assigneeId: body.assigneeId,
      dueAt: body.dueAt,
      notes: body.notes,
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'create_failed';
    const status = message.includes('not permitted') || message.includes('may not') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
