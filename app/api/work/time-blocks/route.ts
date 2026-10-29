import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { BLOCK_TITLE_MAX, createTimeBlocks, listTimeBlocks } from '@/db/repositories/time-blocks';
import { parseJsonBody } from '@/lib/api/parse-body';
import { canUseWorkTools } from '@/lib/work/work-access';
import { errorText, workErrorStatus } from '@/lib/work/route-errors';

const isoSchema = z.string().datetime({ offset: true });
const blockSchema = z.object({
  itemKey: z.string().trim().min(3).max(200).nullable().optional(),
  title: z.string().trim().min(1).max(BLOCK_TITLE_MAX),
  startsAt: isoSchema,
  endsAt: isoSchema,
});
const createSchema = z.object({ blocks: z.array(blockSchema).min(1).max(40) });

/** GET /api/work/time-blocks?from=<iso>&to=<iso> — the caller's blocks in the range (45 days at most). */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canUseWorkTools(guard.ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const from = isoSchema.safeParse(params.get('from') ?? '');
  const to = isoSchema.safeParse(params.get('to') ?? '');
  if (!from.success || !to.success) return NextResponse.json({ error: 'invalid_range' }, { status: 400 });
  try {
    return NextResponse.json({ blocks: await listTimeBlocks(guard.ctx, { from: from.data, to: to.data }) });
  } catch (err) {
    const message = errorText(err, 'list_failed');
    return NextResponse.json({ error: message }, { status: workErrorStatus(message) });
  }
}

/** POST /api/work/time-blocks { blocks: [{ itemKey?, title, startsAt, endsAt }] } — plan one or more blocks. */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canUseWorkTools(guard.ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await parseJsonBody(request, createSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const blocks = await createTimeBlocks(guard.ctx, body.data.blocks);
    if (!blocks) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ blocks }, { status: 201 });
  } catch (err) {
    const message = errorText(err, 'create_failed');
    return NextResponse.json({ error: message }, { status: workErrorStatus(message) });
  }
}
