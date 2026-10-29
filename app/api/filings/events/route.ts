import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { listFilingEvents } from '@/db/repositories/filing-events';

/**
 * GET /api/filings/events?ids=a,b — the dated thread of the given filings (S-771), oldest first.
 * The repository keeps only the filings in the caller's scope; a foreign id reads as no events.
 */
export async function GET(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern', 'client');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const raw = new URL(request.url).searchParams.get('ids') ?? '';
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s));
  const events = await listFilingEvents(guard.ctx, ids);
  return NextResponse.json({ events });
}
