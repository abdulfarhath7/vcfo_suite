import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/auth/guards';
import { getSuperFirmInsights } from '@/db/repositories/super-overview';

/**
 * GET /api/super/insights — the scoped read behind the super admin Practice areas, Team,
 * Risks, Growth and Reports screens.
 *
 * Same door as `/api/super/overview`: `requireSuperAdmin` answers 403 for every other role,
 * and the repository asserts firm-wide scope again on its own. Read-only.
 */
export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const insights = await getSuperFirmInsights(guard.ctx);
  return NextResponse.json({ insights });
}
