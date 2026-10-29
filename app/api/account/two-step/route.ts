import { NextResponse } from 'next/server';
import { requireOwnAccount } from '@/auth/guards';
import { getOwnTwoStep } from '@/db/repositories/profiles';

/** GET /api/account/two-step — whether the caller's two-step sign-in is on (G-25). */
export async function GET() {
  const guard = await requireOwnAccount();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  return NextResponse.json(await getOwnTwoStep(guard.ctx));
}
