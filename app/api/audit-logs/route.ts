import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { listAuditEvents } from '@/db/repositories/audit-events';

/**
 * GET /api/audit-logs — role-scoped audit feed (Path A in listAuditEvents).
 * Intern: own actor + assigned-engagement events. Manager: owned clients only.
 * Client: own engagements. Admin/super: firm-wide.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const url = new URL(request.url);
  const engagementParam = url.searchParams.get('engagementId')?.trim();
  const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '100', 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;

  try {
    const events = await listAuditEvents(guard.ctx, {
      engagementId: engagementParam || null,
      limit,
    });
    return NextResponse.json({
      ok: true,
      events,
      scope: engagementParam ? 'project' : 'global',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'fetch_failed';
    return NextResponse.json(
      {
        ok: false,
        error: 'fetch_failed',
        detail: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 },
    );
  }
}
