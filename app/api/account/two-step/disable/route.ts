import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwnAccount } from '@/auth/guards';
import { disableOwnTwoStep } from '@/db/repositories/profiles';
import { parseJsonBody } from '@/lib/api/parse-body';

const bodySchema = z.object({ code: z.string().trim().min(6).max(12) });

const STATUS = { not_on: 409, invalid_code: 400, locked: 429 } as const;

/** POST /api/account/two-step/disable — turns two-step sign-in off; needs a current code (G-25). */
export async function POST(request: Request) {
  const guard = await requireOwnAccount();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: 400 });
  const result = await disableOwnTwoStep(guard.ctx, body.data.code);
  if (result.ok === false) return NextResponse.json({ error: result.error }, { status: STATUS[result.error] });
  return NextResponse.json({ enabled: false, enabledAt: null });
}
