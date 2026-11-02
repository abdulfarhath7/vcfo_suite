import { NextResponse } from 'next/server';
import { parseJsonBody } from '@/lib/api/parse-body';
import { insertPublicDemoRequest, systemFirmSupportEmail } from '@/db/repositories/demo-requests';
import { sendEmail } from '@/lib/email/send-email';
import {
  cleanDemoRequest,
  clientIp,
  createRateLimiter,
  demoRequestEmail,
  demoRequestSchema,
  isHoneypotFilled,
} from '@/lib/growth/demo-request';

/**
 * POST /api/public/demo-request — the public "Book a demo" form on /contact (G-30).
 *
 * No session: this is a public route. It validates with zod (400 on bad input), answers a
 * filled honeypot with a quiet 200 and stores nothing, allows five requests per IP per ten
 * minutes in this instance's memory (429 after that), inserts into `demo_requests`, then
 * emails the firm. The notice goes to `DEMO_REQUEST_TO`, else to the firm settings support
 * email, else it is skipped with a log; a failed email never fails the request, because the
 * row is already stored and shows on Growth.
 */
const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60_000 });

async function noticeAddress(): Promise<string | null> {
  const fromEnv = process.env.DEMO_REQUEST_TO?.trim();
  if (fromEnv) return fromEnv;
  return systemFirmSupportEmail();
}

export async function POST(request: Request) {
  if (!limiter.take(clientIp(request.headers))) {
    return NextResponse.json({ error: 'Too many requests. Try again in a few minutes.' }, { status: 429 });
  }
  const body = await parseJsonBody(request, demoRequestSchema);
  if (body.ok === false) {
    return NextResponse.json({ error: body.error, issues: body.issues }, { status: 400 });
  }
  if (isHoneypotFilled(body.data)) {
    return NextResponse.json({ ok: true });
  }

  const row = cleanDemoRequest(body.data);
  try {
    await insertPublicDemoRequest(row);
  } catch (err) {
    console.error('[demo-request] insert failed', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Could not send the request. Try again.' }, { status: 500 });
  }

  const to = await noticeAddress();
  if (!to) {
    console.log('[demo-request] stored; no DEMO_REQUEST_TO or firm support email, so no notice was sent');
  } else {
    const mail = demoRequestEmail(row);
    const res = await sendEmail({ to, replyTo: row.email, ...mail, purpose: 'demo_request.notice' });
    if (!res.ok && !res.skipped) console.warn('[demo-request] notice failed', res.error);
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
