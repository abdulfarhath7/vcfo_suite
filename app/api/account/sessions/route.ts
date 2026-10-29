import { NextResponse } from 'next/server';
import { requireOwnAccount } from '@/auth/guards';
import { listOwnSessions } from '@/db/repositories/user-sessions';

/** GET /api/account/sessions — the caller's signed-in devices (G-25). */
export async function GET() {
  const guard = await requireOwnAccount();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  return NextResponse.json({ sessions: await listOwnSessions(guard.ctx) });
}
