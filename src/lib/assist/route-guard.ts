import 'server-only';

import { NextResponse } from 'next/server';
import { requireAuth, type AuthContext } from '@/auth/guards';
import { canUseAssist } from '@/lib/assist/access';
import { assistConfig } from '@/lib/assist/config';

/**
 * Every Assist route: feature flag (404 when off) → session (401) → role
 * (403 for managers and Project Leads).
 */
export async function requireAssist(): Promise<{ ok: true; ctx: AuthContext } | { ok: false; response: NextResponse }> {
  if (!assistConfig().enabled) {
    return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  const guard = await requireAuth();
  if (guard.ok === false) {
    return { ok: false, response: NextResponse.json({ error: guard.error }, { status: guard.status }) };
  }
  if (!canUseAssist(guard.ctx.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Assist is not available for your role' }, { status: 403 }) };
  }
  return { ok: true, ctx: guard.ctx };
}
