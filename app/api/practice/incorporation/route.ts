import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { listPracticeIncorporation } from '@/db/repositories/practice-incorporation';

/**
 * GET /api/practice/incorporation — the clients behind the staff Incorporation page (R-51):
 * phase, current step, owner and progress for every client in the caller's own scope. A lead
 * gets their own clients, a manager their team's, an admin or super admin every client.
 *
 * Staff only: a client or a developer gets 403 here, and the repository refuses them again
 * before any query. Read-only.
 */
export async function GET() {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const clients = await listPracticeIncorporation(guard.ctx);
  return NextResponse.json({ clients }, { headers: { 'cache-control': 'no-store' } });
}
