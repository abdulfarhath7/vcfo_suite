import 'server-only';

import { NextResponse } from 'next/server';
import { requireAuth, type AuthContext } from '@/auth/guards';
import { canUseAsk } from '@/lib/ask/access';

/**
 * Client-portal Library routes: session (401) → role (403 for managers and
 * Project Leads, who have no library). Deliberately NOT the Ask VCFO feature
 * flag — saved books, reading and the reader work with Ask VCFO off.
 */
export async function requireLibrary(): Promise<{ ok: true; ctx: AuthContext } | { ok: false; response: NextResponse }> {
  const guard = await requireAuth();
  if (guard.ok === false) return { ok: false, response: NextResponse.json({ error: guard.error }, { status: guard.status }) };
  if (!canUseAsk(guard.ctx.role)) return { ok: false, response: NextResponse.json({ error: 'Not available for your role' }, { status: 403 }) };
  return { ok: true, ctx: guard.ctx };
}
