import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { setNeedMeta } from '@/db/repositories/client-home';
import { isNeedKind } from '@/lib/client/client-home';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/client/home/needs/[id] — staff (admin / manager / lead) say what
 * a document request is for: { stepId, complianceInstanceId, kind, dueDate,
 * fieldId }. Drives the client Home "Needs from …" card. Clients get 404.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const due = str(body.dueDate);
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    return NextResponse.json({ error: 'invalid_due_date' }, { status: 400 });
  }
  const ok = await setNeedMeta(guard.ctx, id, {
    stepId: str(body.stepId),
    complianceInstanceId: str(body.complianceInstanceId),
    kind: isNeedKind(body.kind) ? body.kind : undefined,
    dueDate: due,
    fieldId: str(body.fieldId),
  });
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
