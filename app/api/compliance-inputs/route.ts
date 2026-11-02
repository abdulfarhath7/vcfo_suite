import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import {
  InputsForbiddenError,
  askSubjectDocument,
  confirmSubjectFields,
  getSubjectInputs,
  reviewSubjectDocument,
  saveSubjectFields,
} from '@/db/repositories/compliance-inputs';

/**
 * What the client gives and what SBC records on one obligation period or registration
 * (C-415, C-417, C-491, C-492, S-774, S-811).
 *
 * GET  /api/compliance-inputs?engagementId=&kind=obligation|registration&key=
 *      — documents with their status words and the client and SBC fields. A client reads
 *      its own engagement without `engagementId`.
 * POST /api/compliance-inputs { action, … }
 *      save    { kind, key, side, values, engagementId? } — a client submits its details;
 *              staff save SBC fields (or correct client ones).
 *      confirm { kind, key, engagementId }               — staff confirm the client's details.
 *      ask     { kind, key, engagementId, label, dueOn? } — staff ask for a document.
 *      accept  { requestId } · send-back { requestId, reason } — staff review an upload.
 * Client uploads go to POST /api/client/documents/requests/[id]/upload.
 */
const kind = z.enum(['obligation', 'registration']);
const key = z.string().trim().min(1).max(120);
const engagementId = z.string().trim().min(1).max(80);

export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const p = new URL(request.url).searchParams;
  const parsed = z
    .object({ engagementId: engagementId.optional(), kind, key })
    .safeParse({ engagementId: p.get('engagementId') ?? undefined, kind: p.get('kind'), key: p.get('key') });
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 });
  const inputs = await getSubjectInputs(guard.ctx, parsed.data);
  if (!inputs) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, inputs }, { headers: { 'Cache-Control': 'private, no-store' } });
}

const body = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('save'),
    engagementId: engagementId.optional(),
    kind,
    key,
    side: z.enum(['client', 'sbc']),
    values: z.record(z.string().max(60), z.string().max(500).nullable()),
  }),
  z.object({ action: z.literal('confirm'), engagementId, kind, key }),
  z.object({ action: z.literal('ask'), engagementId, kind, key, label: z.string().trim().min(1).max(200), dueOn: z.string().max(10).optional() }),
  z.object({ action: z.literal('accept'), requestId: z.string().uuid() }),
  z.object({ action: z.literal('send-back'), requestId: z.string().uuid(), reason: z.string().trim().min(1, 'Enter a reason first').max(500) }),
]);

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const parsed = await parseJsonBody(request, body);
  if (parsed.ok === false) return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.status });
  const b = parsed.data;
  try {
    let ok: boolean;
    let requestId: string | null = null;
    if (b.action === 'save') ok = await saveSubjectFields(guard.ctx, b);
    else if (b.action === 'confirm') ok = await confirmSubjectFields(guard.ctx, b);
    else if (b.action === 'ask') {
      requestId = await askSubjectDocument(guard.ctx, b);
      ok = Boolean(requestId);
    } else ok = await reviewSubjectDocument(guard.ctx, { requestId: b.requestId, action: b.action, reason: b.action === 'send-back' ? b.reason : null });
    if (!ok) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, ...(requestId ? { requestId } : {}) });
  } catch (e) {
    if (e instanceof InputsForbiddenError) return NextResponse.json({ ok: false, error: e.message }, { status: 403 });
    console.error('[compliance-inputs] failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
