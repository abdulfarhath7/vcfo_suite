import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { listClosedTimelineRequests } from '@/db/repositories/timeline-requests';

/**
 * GET /api/timeline-requests?days=30 — the client timeline change requests
 * closed (approved, declined, withdrawn) in the last `days` days across the
 * caller's book, with who decided and their note (Date requests › Decided).
 * Pending ones stay on GET /api/engagements/:id/timeline-requests.
 */
export async function GET(request: Request) {
  const guard = await requireAnyRole('manager', 'admin', 'super_admin');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const raw = Number(new URL(request.url).searchParams.get('days') ?? '30');
  const requests = await listClosedTimelineRequests(guard.ctx, { sinceDays: Number.isFinite(raw) ? raw : 30 });
  return NextResponse.json({ requests });
}
