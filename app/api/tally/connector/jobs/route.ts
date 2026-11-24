import { NextResponse } from 'next/server';
import { claimNextJob, touchConnector } from '@/db/repositories/receivables';
import { connectorFrom, serverError } from '../_auth';

/**
 * GET /api/tally/connector/jobs — the connector's long-poll. Waits up to 45 seconds, looking for a
 * queued sync every 3 seconds, and answers as soon as one is found: 200 {job: {id, type, from, to}}
 * (the job is now running), or 204 when none came. Each call marks the connector as seen.
 */
const WAIT_MS = 45_000;
const STEP_MS = 3_000;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true });
  });

export async function GET(request: Request) {
  const auth = await connectorFrom(request);
  if (auth.ok === false) return auth.response;
  try {
    await touchConnector(auth.connector);
    const until = Date.now() + WAIT_MS;
    for (;;) {
      const job = await claimNextJob(auth.connector);
      if (job) return NextResponse.json({ job });
      if (request.signal.aborted || Date.now() + STEP_MS > until) break;
      await sleep(STEP_MS, request.signal);
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return serverError('jobs', e);
  }
}
