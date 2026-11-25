import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/auth/guards';
import { publicErrorMessage } from '@/lib/api-error';
import { acceptAllSuggested, decideLink, getFirmConnection, listMapTargetOptions } from '@/db/repositories/integrations';
import { queueZohoDiscover } from '@/lib/integrations/zoho/run-discover';

/**
 * GET  /api/integrations/zoho/links — the VCFO records a Zoho item may be mapped to (the picker).
 * POST /api/integrations/zoho/links — one decision `{ linkId, action, vcfoType?, vcfoId? }`, or
 *      `{ action: 'accept_all' }`. Setting a Books organisation to the firm runs discovery again,
 *      so the firm's customers are matched to its receivable clients.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    return NextResponse.json({ targets: await listMapTargetOptions(guard.ctx) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, 'targets_failed') }, { status: 500 });
  }
}

const Body = z.union([
  z.object({ action: z.literal('accept_all') }),
  z.object({ linkId: z.string().uuid(), action: z.enum(['accept', 'ignore', 'clear']) }),
  z.object({ linkId: z.string().uuid(), action: z.literal('set'), vcfoType: z.enum(['engagement', 'receivable_client', 'firm']), vcfoId: z.string().uuid().nullable() }),
]);

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  const body = parsed.data;
  try {
    if (body.action === 'accept_all') return NextResponse.json({ ok: true, accepted: await acceptAllSuggested(guard.ctx) });
    const decision = body.action === 'set' ? { action: 'set' as const, vcfoType: body.vcfoType, vcfoId: body.vcfoId } : { action: body.action };
    const link = await decideLink(guard.ctx, body.linkId, decision);
    if (!link) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (body.action === 'set' && body.vcfoType === 'firm' && link.externalType === 'org') {
      const conn = await getFirmConnection(guard.ctx);
      if (conn) await queueZohoDiscover(conn.id, guard.ctx.userId);
    }
    return NextResponse.json({ ok: true, link });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, 'link_failed') }, { status: 500 });
  }
}
