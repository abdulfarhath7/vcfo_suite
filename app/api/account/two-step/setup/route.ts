import { NextResponse } from 'next/server';
import { requireOwnAccount } from '@/auth/guards';
import { startOwnTwoStepSetup } from '@/db/repositories/profiles';

/**
 * POST /api/account/two-step/setup — starts two-step setup for the caller (G-25).
 * Returns the base32 key and the `otpauth://` link once; sign-in does not ask
 * for a code until `/confirm` accepts a first code.
 */
export async function POST() {
  const guard = await requireOwnAccount();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const result = await startOwnTwoStepSetup(guard.ctx);
  if (result === 'already_on') return NextResponse.json({ error: 'already_on' }, { status: 409 });
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}
