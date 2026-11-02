import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { listChecklistTicks, setChecklistTick } from '@/db/repositories/compliance-checklist-checks';

/**
 * The "Before filing" ticks of an obligation period or a registration (S-783, S-816). Staff
 * only; the repository checks the engagement scope and reads a foreign one as no ticks.
 *
 * GET  /api/compliance-checklist?engagementId=&kind=obligation|registration&key=
 * POST /api/compliance-checklist  { engagementId, kind, key, item, checked }
 */

const kind = z.enum(['obligation', 'registration']);

export async function GET(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const params = new URL(request.url).searchParams;
  const parsed = z
    .object({ engagementId: z.string().min(1).max(64), kind, key: z.string().min(1).max(120) })
    .safeParse({ engagementId: params.get('engagementId'), kind: params.get('kind'), key: params.get('key') });
  if (!parsed.success) return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  const ticks = await listChecklistTicks(guard.ctx, {
    engagementId: parsed.data.engagementId,
    subjectKind: parsed.data.kind,
    subjectKey: parsed.data.key,
  });
  return NextResponse.json({ ticks });
}

const bodySchema = z.object({
  engagementId: z.string().min(1).max(64),
  kind,
  key: z.string().min(1).max(120),
  item: z.string().min(1).max(120),
  checked: z.boolean(),
});

export async function POST(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  const ok = await setChecklistTick(guard.ctx, {
    engagementId: body.data.engagementId,
    subjectKind: body.data.kind,
    subjectKey: body.data.key,
    itemKey: body.data.item,
    checked: body.data.checked,
  });
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
