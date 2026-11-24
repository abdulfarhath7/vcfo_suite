import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { pairConnector } from '@/db/repositories/receivables';
import { serverError } from '../_auth';

/**
 * POST /api/tally/connector/pair — {code, name, version, tallyCompany} → {token, sheetName}. The
 * code is the 8-character one shown once on the Sheet tab (valid 10 minutes). The token is shown
 * only in this answer; a new pairing revokes the sheet's older connector. A wrong, used or old code
 * gets 400 `invalid_code`.
 */
const schema = z.object({
  code: z.string().min(1, 'invalid_code').max(20, 'invalid_code'),
  name: z.string().max(200).nullable().optional(),
  version: z.string().max(80).nullable().optional(),
  tallyCompany: z.string().max(400).nullable().optional(),
});

export async function POST(request: Request) {
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const paired = await pairConnector(body.data);
    if (!paired) return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
    return NextResponse.json(paired);
  } catch (e) {
    return serverError('pair', e);
  }
}
