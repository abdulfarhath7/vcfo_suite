import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { FilingStatusError, markFilingFiled, reopenFiling } from '@/db/repositories/filing-status';

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('file'),
    filedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date').optional(),
    note: z.string().max(500).optional(),
  }),
  z.object({ action: z.literal('reopen') }),
]);

/** PATCH /api/filings/:id/status — mark one compliance filing filed, or reopen it (staff). */
export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });

  try {
    const row =
      body.data.action === 'file'
        ? await markFilingFiled(guard.ctx, id, { filedOn: body.data.filedOn, note: body.data.note })
        : await reopenFiling(guard.ctx, id);
    return NextResponse.json({ row });
  } catch (err) {
    if (err instanceof FilingStatusError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'status_failed' }, { status: 500 });
  }
}
