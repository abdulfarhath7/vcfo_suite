import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { getSignName, setSignName } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError } from '../_respond';

/**
 * GET /api/receivables/sign-name — the caller's saved email sign name ("Regards, <name>").
 * PUT { name } — saves it until they change it again; an empty name falls back to the profile name.
 */
export async function GET() {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  try {
    return NextResponse.json({ name: await getSignName(guard.ctx) });
  } catch (e) {
    return receivablesError(e);
  }
}

const schema = z.object({ name: z.string().max(200) });

export async function PUT(request: Request) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ name: await setSignName(guard.ctx, body.data.name) });
  } catch (e) {
    return receivablesError(e);
  }
}
