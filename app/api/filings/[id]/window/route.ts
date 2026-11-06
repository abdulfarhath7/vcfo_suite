import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { setComplianceInstanceWindow } from '@/db/repositories/schedule';
import { windowFields, withBothDates } from '@/lib/actions/compliance/rules';
import { publicErrorMessage } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = withBothDates(windowFields);

/** POST /api/filings/:id/window — set or clear the working window on one compliance instance. */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id } = await context.params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
  const { from, to } = body.data;
  try {
    const row = await setComplianceInstanceWindow(guard.ctx, id, from && to ? { from, to } : null);
    return NextResponse.json({ row });
  } catch (err) {
    const message = publicErrorMessage(err, 'window_failed');
    const status =
      message.includes('Only a project manager') ? 403
      : message.includes('not found') || message.includes('not permitted') ? 404
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
