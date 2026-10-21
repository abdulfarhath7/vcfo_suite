import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { setDocumentRequestDetails } from '@/db/repositories/client-documents';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/requests/[id]/details — staff set a request's due date, owning
 * checklist step / field and the re-upload note the client sees
 * ({ dueOn?: 'yyyy-mm-dd'|null, stepId?, fieldId?, reviewNote? }).
 */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (auth.ok === false) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const str = (v: unknown) => (v === null ? null : typeof v === 'string' ? v : undefined);
  const ok = await setDocumentRequestDetails(auth.ctx, id, {
    dueOn: str(body.dueOn),
    stepId: str(body.stepId),
    fieldId: str(body.fieldId),
    reviewNote: str(body.reviewNote),
  });
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
