import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { ClientAccountError, getOwnClientAccount, updateOwnClientAccount } from '@/db/repositories/client-account';

/**
 * GET   /api/client/account — the caller's designation and reminder lead time.
 * PATCH /api/client/account — { designation?, remindDays? }. Owner only, client role
 * only; access lives in `client-account.ts`.
 */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    return NextResponse.json({ account: await getOwnClientAccount(guard.ctx) });
  } catch (e) {
    return fail(e);
  }
}

const patchSchema = z.object({
  designation: z.string().trim().max(80).nullable().optional(),
  remindDays: z.union([z.literal(7), z.literal(3), z.literal(1), z.null()]).optional(),
});

export async function PATCH(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, patchSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ account: await updateOwnClientAccount(guard.ctx, body.data) });
  } catch (e) {
    return fail(e);
  }
}

function fail(e: unknown) {
  if (e instanceof ClientAccountError) return NextResponse.json({ error: e.message }, { status: e.status });
  throw e;
}
