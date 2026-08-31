import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/auth/guards';
import { getSuperAdminOverview } from '@/db/repositories/super-overview';

/**
 * GET /api/super/overview — the single scoped read behind the super admin
 * observatory.
 *
 * `requireSuperAdmin` is the only door: every other role (including firm admin
 * and project manager) gets 403 here, and the repository asserts firm-wide
 * scope again on its own so the guard is not the only thing standing between a
 * narrow role and a firm-wide aggregate.
 *
 * Read-only. There is no POST/PATCH on this surface (context §3: observatory).
 */
export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const overview = await getSuperAdminOverview(guard.ctx);
  return NextResponse.json({ overview });
}
