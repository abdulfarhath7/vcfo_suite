import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { systemSheetsWithAutoEmails } from '@/db/repositories/receivables';
import { prepareDueEmails } from '@/lib/receivables/v2-send';

/**
 * POST /api/cron/receivables — the hourly clock (owner, 20 Nov 2026). An AWS EventBridge rule
 * calls it at :05 IST with the `x-cron-secret` header. It prepares the roll-up and digest that are
 * due on every sheet; each waits for approval and the team gets a WhatsApp. It sends no email.
 * Without CRON_SECRET set, or with a wrong secret, it answers 404.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET ?? '';
  const given = request.headers.get('x-cron-secret') ?? '';
  const ok = secret.length >= 32 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const sheets = await systemSheetsWithAutoEmails();
  for (const s of sheets) await prepareDueEmails(s.id);
  return NextResponse.json({ ok: true, sheets: sheets.length });
}
