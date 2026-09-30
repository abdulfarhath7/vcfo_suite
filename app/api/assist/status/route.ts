import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { canUseAssist } from '@/lib/assist/access';
import { assistConfig } from '@/lib/assist/config';
import { firmDisplayName } from '@/lib/brand';

/**
 * GET /api/assist/status — whether the launcher should show for this user.
 * Read at runtime so ASSIST_ENABLED flips without a rebuild. Managers and
 * Project Leads always get `enabled: false`.
 */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const enabled = assistConfig().enabled && canUseAssist(guard.ctx.role);
  return NextResponse.json({ enabled, firmName: firmDisplayName() }, { headers: { 'Cache-Control': 'no-store' } });
}
