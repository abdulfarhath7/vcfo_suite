import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePartner } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { partnerHome, setNotifyOnPublish } from '@/db/repositories/receivables';
import { denied, receivablesError } from '../../_respond';
import { externalOffResponse } from '@/lib/receivables/external';

/**
 * GET   /api/receivables/partner/me — the signed-in client partner's own invoices of the latest
 *       published version (PartnerHomeDto in src/lib/receivables/partner-wire.ts).
 * PATCH /api/receivables/partner/me — { notifyOnPublish } turns the publish alert email on or off.
 */
export async function GET() {
  // Receivables v2: partner-facing, off unless RECEIVABLES_EXTERNAL=on.
  const off = externalOffResponse();
  if (off) return off;
  const guard = await requirePartner();
  if (guard.ok === false) return denied(guard);
  try {
    return NextResponse.json(await partnerHome(guard.ctx), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return receivablesError(e);
  }
}

const patchSchema = z.object({ notifyOnPublish: z.boolean({ message: 'notify_on_publish' }) });

export async function PATCH(request: Request) {
  // Receivables v2: partner-facing, off unless RECEIVABLES_EXTERNAL=on.
  const off = externalOffResponse();
  if (off) return off;
  const guard = await requirePartner();
  if (guard.ok === false) return denied(guard);
  const body = await parseJsonBody(request, patchSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    await setNotifyOnPublish(guard.ctx, body.data.notifyOnPublish);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return receivablesError(e);
  }
}
