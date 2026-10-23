import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { listRegulatoryUpdates, type ReviewStatus } from '@/db/repositories/ask-documents';
import { feedLabel } from '@/lib/ask/feeds/registry';

const STATUSES: readonly ReviewStatus[] = ['pending', 'approved', 'rejected'];

/**
 * GET /api/regulatory-updates?status=pending — official updates the watchers
 * found, for the manager's review page (admins and super admins may look).
 * Not behind the Ask VCFO feature flag: the review queue is a firm process.
 */
export async function GET(request: Request) {
  const gate = await requireAnyRole('manager', 'admin', 'super_admin');
  if (gate.ok === false) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const status = new URL(request.url).searchParams.get('status');
  const reviewStatus = STATUSES.includes(status as ReviewStatus) ? (status as ReviewStatus) : undefined;
  try {
    const rows = await listRegulatoryUpdates(gate.ctx, { reviewStatus });
    return NextResponse.json({
      canDecide: gate.ctx.role === 'manager',
      updates: rows.map((r) => ({ ...r, feed: feedLabel(r.feedId) })),
    });
  } catch (error) {
    console.error('[regulatory-updates] list failed', error);
    return NextResponse.json({ error: 'Could not load the updates' }, { status: 500 });
  }
}
