import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { FilingFiledError, setComplianceInstanceFiled } from '@/db/repositories/filing-filed';

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  filedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date').nullable(),
});

/** POST /api/filings/:id/filed — mark one compliance instance filed on a date, or clear it (`null`). */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const row = await setComplianceInstanceFiled(guard.ctx, id, body.data.filedOn);
    return NextResponse.json({ row });
  } catch (err) {
    if (err instanceof FilingFiledError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
