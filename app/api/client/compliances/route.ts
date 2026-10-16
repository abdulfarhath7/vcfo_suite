import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { getPortalFilings } from '@/db/repositories/client-compliances';
import { parseFyParam } from '@/lib/filings';
import { todayIso } from '@/lib/client-portal/compliances';

/**
 * GET /api/client/compliances?fy=2026 — the client portal register (calendar +
 * filings pages): FilingRow plus period dates, penalty risk, owner, ARN / tax
 * paid / filed by, focus-track dates, proof count and the caller's reminder.
 * Scoped by AuthContext in the repository (a client reads only their company).
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const fy = parseFyParam(new URL(request.url).searchParams.get('fy')) ?? undefined;
  const rows = await getPortalFilings(guard.ctx, { fyStartYear: fy });
  return NextResponse.json({ rows, today: todayIso() });
}
