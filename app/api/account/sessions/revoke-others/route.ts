import { NextResponse } from 'next/server';
import { requireOwnAccount } from '@/auth/guards';
import { noDemo } from '@/lib/demo-logins';
import { revokeOwnOtherSessions } from '@/db/repositories/user-sessions';

/** POST /api/account/sessions/revoke-others — "Sign out everywhere else" (G-25). */
export async function POST() {
  const guard = noDemo(await requireOwnAccount());
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const revoked = await revokeOwnOtherSessions(guard.ctx);
  return NextResponse.json({ revoked });
}
