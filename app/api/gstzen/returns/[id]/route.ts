import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { getRunBundle, runReturnAction } from '@/lib/gstzen/returns';
import { GSTZEN_STAFF_ROLES, gstzenErrorResponse } from '@/lib/gstzen/route-errors';

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save') }),
  z.object({ action: z.literal('retry') }),
  z.object({ action: z.literal('check'), which: z.enum(['figures', 'unmatched']), checked: z.boolean() }),
  z.object({ action: z.literal('offset') }),
  z.object({ action: z.literal('proceed') }),
  z.object({ action: z.literal('refresh_balance') }),
  z.object({ action: z.literal('evc'), audience: z.enum(['staff', 'client']), signatoryPan: z.string().max(10).optional().nullable() }),
  z.object({ action: z.literal('cancel') }),
]);

/**
 * GET /api/gstzen/returns/:id — the run, its GSTN session and its open OTP requests.
 * POST /api/gstzen/returns/:id — one card action (save, retry, the certifier checks, offset, proceed
 * to file, read the cash balance again, ask for the EVC OTP, cancel). Staff only; another lead's run
 * reads as not found; actions that call GSTZen answer 503 while the route is closed.
 */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAnyRole(...GSTZEN_STAFF_ROLES);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  try {
    return NextResponse.json(await getRunBundle(guard.ctx, id));
  } catch (err) {
    return gstzenErrorResponse(err);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole(...GSTZEN_STAFF_ROLES);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json(await runReturnAction(guard.ctx, id, body.data));
  } catch (err) {
    return gstzenErrorResponse(err);
  }
}
