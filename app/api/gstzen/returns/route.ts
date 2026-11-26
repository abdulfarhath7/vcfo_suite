import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { filingInstancePeriod, listGstReturnRuns, toRunView } from '@/db/repositories/gst-returns';
import { startReturnRun } from '@/lib/gstzen/returns';
import { GSTZEN_STAFF_ROLES, gstzenErrorResponse } from '@/lib/gstzen/route-errors';
import { isGstForm, isRetPeriod, retPeriodFor } from '@/lib/gstzen/types';

/**
 * GET /api/gstzen/returns?engagementId=&form=&period= — the engagement's GST return runs, newest
 * first (stored data only; no GSTZen call). POST /api/gstzen/returns — start (or reopen) the run for
 * a form and period. Staff only; POST answers 503 while the GSTZen route is closed.
 */
export async function GET(request: Request) {
  const guard = await requireAnyRole(...GSTZEN_STAFF_ROLES);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const q = new URL(request.url).searchParams;
  const engagementId = q.get('engagementId')?.trim();
  const form = q.get('form');
  let period = q.get('period');
  const instanceId = q.get('instanceId');
  if (!engagementId) return NextResponse.json({ error: 'engagementId is required' }, { status: 400 });
  if (form && !isGstForm(form)) return NextResponse.json({ error: 'Unknown form' }, { status: 400 });
  if (period && !isRetPeriod(period)) return NextResponse.json({ error: 'The period is MMYYYY' }, { status: 400 });
  try {
    // With a filing instance and no period, the period is the instance's own.
    if (!period && instanceId && form && isGstForm(form)) {
      const inst = await filingInstancePeriod(guard.ctx, engagementId, instanceId);
      period = inst ? retPeriodFor(form, inst) : null;
    }
    const rows = await listGstReturnRuns(guard.ctx, engagementId, { form: form && isGstForm(form) ? form : undefined, period: period ?? undefined });
    return NextResponse.json({ runs: await Promise.all(rows.map(toRunView)), period: period ?? null });
  } catch (err) {
    return gstzenErrorResponse(err);
  }
}

const bodySchema = z.object({
  engagementId: z.string().min(1).max(100),
  form: z.enum(['gstr1', 'gstr3b', 'gstr9', 'gstr9c']),
  period: z.string().refine(isRetPeriod, 'The period is MMYYYY'),
});

export async function POST(request: Request) {
  const guard = await requireAnyRole(...GSTZEN_STAFF_ROLES);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json(await startReturnRun(guard.ctx, body.data));
  } catch (err) {
    return gstzenErrorResponse(err);
  }
}
