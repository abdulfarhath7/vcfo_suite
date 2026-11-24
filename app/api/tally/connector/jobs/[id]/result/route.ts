import { NextResponse } from 'next/server';
import { gunzipSync } from 'node:zlib';
import { z } from 'zod';
import { TallyJobError, saveJobResult } from '@/db/repositories/receivables';
import type { TallyJobResult } from '@/lib/receivables/tally-live/wire';
import { connectorFrom, serverError } from '../../../_auth';

/**
 * POST /api/tally/connector/jobs/:id/result — the vouchers of a running job, or the connector's
 * error. The body is JSON, gzip-compressed or not (`Content-Encoding: gzip`, or the gzip magic
 * bytes), at most 20 MB as sent and 100 MB unpacked. Answers 200 {staged}; the rows then wait in
 * the Sheet tab's Awaiting approval panel.
 */
const MAX_WIRE = 20 * 1024 * 1024;
const MAX_JSON = 100 * 1024 * 1024;

const voucher = z.object({
  guid: z.string().max(200),
  voucherType: z.string().max(200),
  voucherNo: z.string().max(200),
  date: z.string().max(20),
  partyName: z.string().max(400),
  gstin: z.string().max(40).nullable().optional(),
  amount: z.number().finite(),
  bills: z.array(z.object({ name: z.string().max(200), amount: z.number().finite() })).max(2000).optional(),
  cancelled: z.boolean().optional(),
});
const schema = z.union([
  z.object({ ok: z.literal(false), error: z.string().max(2000) }),
  z.object({ ok: z.literal(true), company: z.string().max(400), vouchers: z.array(voucher).max(200_000) }),
]);

/** Reads the body up to the limit; null when it is larger. */
async function readCapped(request: Request): Promise<Buffer | null> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_WIRE) return null;
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_WIRE) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await connectorFrom(request);
  if (auth.ok === false) return auth.response;
  const { id } = await context.params;
  const raw = await readCapped(request);
  if (!raw) return NextResponse.json({ error: 'too_large' }, { status: 413 });
  let parsed: unknown;
  try {
    const gzip = /gzip/i.test(request.headers.get('content-encoding') ?? '') || (raw[0] === 0x1f && raw[1] === 0x8b);
    const text = (gzip ? gunzipSync(raw, { maxOutputLength: MAX_JSON }) : raw).toString('utf8');
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const body = schema.safeParse(parsed);
  // A body we cannot read still ends the job, so the person is not left waiting.
  const result: TallyJobResult = body.success ? body.data : { ok: false, error: 'The connector sent data VCFO could not read. Update the connector and try again.' };
  try {
    const out = await saveJobResult(auth.connector, id, result);
    if (!body.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof TallyJobError) return NextResponse.json({ error: e.message }, { status: e.status });
    return serverError('result', e);
  }
}
