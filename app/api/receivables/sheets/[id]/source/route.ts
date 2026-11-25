import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { getZohoSheetStatus, setSheetSource } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * GET   /api/receivables/sheets/:id/source — the sheet's source (excel, tally, zoho) and its Zoho state.
 * PATCH /api/receivables/sheets/:id/source — {source, zohoApp?, zohoOrgId?}. Choosing Zoho and its
 *       organisation is for firm-wide admins only (docs/specs/integrations/ZOHO.md).
 */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    return NextResponse.json(await getZohoSheetStatus(guard.ctx, id), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return receivablesError(e);
  }
}

const schema = z.object({
  source: z.enum(['excel', 'tally', 'zoho'], { message: 'sheet_source' }),
  zohoApp: z.enum(['books', 'invoice']).optional(),
  zohoOrgId: z.string().min(1).max(40).optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json(await setSheetSource(guard.ctx, id, body.data));
  } catch (e) {
    return receivablesError(e);
  }
}
