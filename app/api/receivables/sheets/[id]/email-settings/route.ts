import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { updateEmailSettings } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/** PATCH /api/receivables/sheets/:id/email-settings — the sheet's automatic email switches and schedule (receivables v2). */
const schema = z.object({
  digestEnabled: z.boolean().optional(),
  digestWeekday: z.number().int().min(0, 'weekday').max(6, 'weekday').optional(),
  digestHourIst: z.number().int().min(6, 'send_hour').max(20, 'send_hour').optional(),
  rollupEveryDays: z.number().int().min(1, 'rollup_days').max(30, 'rollup_days').optional(),
  sendHourIst: z.number().int().min(6, 'send_hour').max(20, 'send_hour').optional(),
  emailNewInvoiceEnabled: z.boolean().optional(),
  emailRollupEnabled: z.boolean().optional(),
  emailRevisedEnabled: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ settings: await updateEmailSettings(guard.ctx, id, body.data) });
  } catch (e) {
    return receivablesError(e);
  }
}
