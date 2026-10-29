import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import {
  StepFieldStateError,
  applyStepFieldAction,
  listStepFieldStates,
} from '@/db/repositories/step-field-states';
import { STEP_FIELD_ACTIONS, type StepFieldAction } from '@/lib/steps/field-states';

type RouteContext = { params: Promise<{ id: string }> };

const idSchema = z.string().trim().min(1).max(80);
const itemSchema = z.string().trim().min(1).max(40);
const actionSchema = z.object({
  itemId: itemSchema,
  fieldId: z.string().trim().min(1).max(120),
  action: z.enum(STEP_FIELD_ACTIONS as unknown as [StepFieldAction, ...StepFieldAction[]]),
  label: z.string().trim().max(200).optional(),
});

function fail(e: unknown) {
  if (e instanceof StepFieldStateError) return NextResponse.json({ ok: false, error: e.code }, { status: e.status });
  console.error('[field-states] route failed', e instanceof Error ? e.message : e);
  return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
}

/**
 * GET /api/engagements/:id/field-states?itemId=pre-8 — the field review states of one step, or of
 * the whole engagement without `itemId` (S-496, S-497). Staff and the engagement's own client.
 */
export async function GET(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern', 'client');
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  const rawItem = new URL(request.url).searchParams.get('itemId');
  const item = rawItem ? itemSchema.safeParse(rawItem) : null;
  if (item && !item.success) return NextResponse.json({ ok: false, error: 'invalid_item' }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, states: await listStepFieldStates(guard.ctx, id.data, item?.data) });
  } catch (e) {
    return fail(e);
  }
}

/**
 * POST /api/engagements/:id/field-states with `{ itemId, fieldId, action, label? }` — ask, remind,
 * mark answered, approve, send back or clear one field (S-496 to S-499). Staff only.
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  const parsed = await parseJsonBody(request, actionSchema);
  if (parsed.ok === false) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    const state = await applyStepFieldAction(guard.ctx, { engagementId: id.data, ...parsed.data });
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    return fail(e);
  }
}
