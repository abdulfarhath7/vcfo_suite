import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { listTemplates, resetTemplate, saveTemplate } from '@/db/repositories/receivables';
import { TEMPLATE_KINDS, isTemplateKind } from '@/lib/receivables/templates';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * /api/receivables/sheets/:id/templates — the sheet's email templates (the Templates tab, owner
 * 19 Nov 2026).
 * GET — every saved template and when it was changed.
 * PUT { kind, subject, greeting, intro, closing } — saves one email type's words; empty parts keep the standard words.
 * DELETE ?kind= — back to the standard words for that email type.
 */
const part = z.string().max(2000, 'too_long').optional();
const schema = z.object({ kind: z.enum(TEMPLATE_KINDS), subject: part, greeting: part, intro: part, closing: part });

export async function GET(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    return NextResponse.json(await listTemplates(guard.ctx, id));
  } catch (e) {
    return receivablesError(e);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const { kind, ...text } = body.data;
    return NextResponse.json({ kind, template: await saveTemplate(guard.ctx, id, kind, text) });
  } catch (e) {
    return receivablesError(e);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const kind = new URL(request.url).searchParams.get('kind');
  if (!isTemplateKind(kind)) return NextResponse.json({ error: 'bad_kind' }, { status: 400 });
  try {
    await resetTemplate(guard.ctx, id, kind);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return receivablesError(e);
  }
}
