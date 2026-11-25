import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { connectorHello } from '@/db/repositories/receivables';
import { connectorFrom, serverError } from '../_auth';

/** POST /api/tally/connector/hello — {version, tallyCompany, tallyReachable} → {ok: true}; the status the Sheet tab shows. */
const schema = z.object({
  version: z.string().max(80).nullable().optional(),
  tallyCompany: z.string().max(400).nullable().optional(),
  tallyReachable: z.boolean().optional(),
});

export async function POST(request: Request) {
  const auth = await connectorFrom(request);
  if (auth.ok === false) return auth.response;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    await connectorHello(auth.connector, body.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError('hello', e);
  }
}
