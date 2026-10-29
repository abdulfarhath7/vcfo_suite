import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwnAccount } from '@/auth/guards';
import { confirmOwnTwoStep } from '@/db/repositories/profiles';
import { parseJsonBody } from '@/lib/api/parse-body';

const bodySchema = z.object({ code: z.string().trim().min(6).max(12) });

const STATUS = { not_started: 409, already_on: 409, invalid_code: 400, locked: 429 } as const;

/** POST /api/account/two-step/confirm — a first code turns two-step sign-in on (G-25). */
export async function POST(request: Request) {
  const guard = await requireOwnAccount();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: 400 });
  const result = await confirmOwnTwoStep(guard.ctx, body.data.code);
  if (result.ok === false) return NextResponse.json({ error: result.error }, { status: STATUS[result.error] });
  return NextResponse.json(result.status);
}
