import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { getFilings } from '@/db/repositories/filings';
import { complianceBaseForRole, filingHits, obligationHits } from '@/lib/search/staff-search';

/**
 * GET /api/search?q= — the staff search palette's (Ctrl K) filing and obligation hits.
 *
 * Staff only (lead, manager, admin, super admin); the client portal has its own
 * `/api/client/portal/search`. The rows come from `getFilings`, which scopes the
 * compliance register by the caller's `AuthContext` (lead: assigned, manager: owned,
 * admin and super admin: the firm), so a hit never names an engagement outside that scope.
 * Clients, steps, registrations, documents and pages are matched in the browser from the
 * scoped roster and reads the palette already has.
 */
export async function GET(request: Request) {
  const guard = await requireAnyRole('admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ hits: [] });

  const { rows } = await getFilings(guard.ctx);
  const now = new Date();
  const base = complianceBaseForRole(guard.ctx.role);
  const hits = [...filingHits(rows, q, base, now), ...obligationHits(rows, q, base, now)];
  return NextResponse.json({ hits }, { headers: { 'cache-control': 'no-store' } });
}
