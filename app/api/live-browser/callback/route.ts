import { NextResponse } from 'next/server';
import { runInScope } from '@/db/demo-scope';
import { NO_STORE } from '@/lib/assist-agents/http';
import { handleLiveBrowserCallback } from '@/lib/live-browser/callback';
import { SIGNATURE_HEADER, verifyBody, type CallbackOp } from '@/lib/live-browser/contract';
import { liveBrowserEnv } from '@/lib/live-browser/broker-client';
import { isSessionId } from '@/lib/live-browser/http';

const MAX_BYTES = 512 * 1024;
const OPS = new Set(['event', 'createRun', 'updateRun', 'attestation', 'resolve', 'proposePatch']);

/**
 * POST /api/live-browser/callback — the live browser broker reports progress and makes the
 * engine's run calls. No session cookie: the body must carry a fresh HMAC signature made with
 * LIVE_BROWSER_SHARED_SECRET (`contract.ts`), or the call is refused with 401 before anything is
 * read. Each op is answered as the person who started its session (`callback.ts`), in the demo
 * database when the session belongs to a demo login.
 */
export async function POST(request: Request) {
  const { secret } = liveBrowserEnv();
  if (!secret) return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503, headers: NO_STORE });
  const length = Number(request.headers.get('content-length') ?? NaN);
  if (Number.isFinite(length) && length > MAX_BYTES) return NextResponse.json({ ok: false, error: 'too_large' }, { status: 413, headers: NO_STORE });
  const raw = await request.text();
  if (raw.length > MAX_BYTES || !verifyBody(secret, request.headers.get(SIGNATURE_HEADER), raw)) {
    return NextResponse.json({ ok: false, error: 'bad_signature' }, { status: 401, headers: NO_STORE });
  }
  let op: CallbackOp;
  try {
    op = JSON.parse(raw) as CallbackOp;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers: NO_STORE });
  }
  if (!op || !OPS.has(op.op) || typeof op.sessionId !== 'string' || !isSessionId(op.sessionId) || typeof op.demo !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'invalid_op' }, { status: 400, headers: NO_STORE });
  }
  try {
    const out = await runInScope(op.demo, () => handleLiveBrowserCallback(op));
    return NextResponse.json(out.body, { status: out.status, headers: NO_STORE });
  } catch (error) {
    console.error('[live-browser] callback failed', op.op, error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}
