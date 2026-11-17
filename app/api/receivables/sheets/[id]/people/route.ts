import { NextResponse } from 'next/server';
import { getEmailSettings, lastAutoSends, listClients, listDigestRecipients, listEmailLog } from '@/db/repositories/receivables';
import { getOwnProfile } from '@/db/repositories/profiles';
import { doubleTickMissing } from '@/lib/notify/send-whatsapp-doubletick';
import { nextDigestAt, nextRollupAt } from '@/lib/receivables/v2-schedule';
import type { PeopleDto } from '@/lib/receivables/v2-wire';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * GET /api/receivables/sheets/:id/people — the People tab (receivables v2): clients with their
 * open balance, the leadership digest recipients, the email switches and schedule, the next
 * roll-up and digest times, the last 50 emails, and whether DoubleTick is configured (the names
 * of missing env vars only, never their values) with the caller's own WhatsApp number.
 */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    const [clients, digestRecipients, emailLog, settings, last, me] = await Promise.all([
      listClients(guard.ctx, id),
      listDigestRecipients(guard.ctx, id),
      listEmailLog(guard.ctx, id, 50),
      getEmailSettings(guard.ctx, id),
      lastAutoSends(guard.ctx, id),
      getOwnProfile(guard.ctx).catch(() => null),
    ]);
    const missing = doubleTickMissing();
    const body: PeopleDto = {
      clients,
      digestRecipients,
      emailLog,
      settings,
      nextRollupAt: nextRollupAt(settings, last.rollup),
      nextDigestAt: nextDigestAt(settings, last.digest),
      whatsapp: { configured: missing.length === 0, missing, myPhone: me?.phoneE164 ?? null },
    };
    return NextResponse.json(body);
  } catch (e) {
    return receivablesError(e);
  }
}
