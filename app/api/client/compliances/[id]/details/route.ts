import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { complianceErrorStatus, upsertFilingDetails } from '@/db/repositories/client-compliances';
import { detailDate, filingDetailsFields } from '@/lib/actions/compliance/rules';
import { publicErrorMessage } from '@/lib/api-error';

type Ctx = { params: Promise<{ id: string }> };

const body = filingDetailsFields.extend({
  filedBy: z.string().uuid().nullable().optional(),
  approvedOn: detailDate,
});

/** PATCH /api/client/compliances/:id/details — staff set ARN, tax paid, filed by, focus-track dates. */
export async function PATCH(request: Request, ctx: Ctx) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await ctx.params;
  const parsed = await parseJsonBody(request, body);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  try {
    await upsertFilingDetails(guard.ctx, id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = complianceErrorStatus(e);
    if (status == null) throw e;
    return NextResponse.json({ error: publicErrorMessage(e, 'request_failed') }, { status });
  }
}
