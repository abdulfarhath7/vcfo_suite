import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { canUseAsk } from '@/lib/ask/access';
import { askConfig } from '@/lib/ask/config';
import { firmDisplayName } from '@/lib/brand';

/**
 * GET /api/ask/status — whether the launcher should show for this user.
 * Read at runtime so ASK_VCFO_ENABLED flips without a rebuild. Managers and
 * Project Leads always get `enabled: false`.
 */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const enabled = askConfig().enabled && canUseAsk(guard.ctx.role);
  return NextResponse.json({ enabled, firmName: firmDisplayName() }, { headers: { 'Cache-Control': 'no-store' } });
}
