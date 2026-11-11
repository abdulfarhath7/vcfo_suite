import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { listAuditEvents } from '@/db/repositories/audit-events';
import { publicErrorMessage } from '@/lib/api-error';
import type { SentEmailRow } from '@/lib/email/sent-email';

type RouteContext = { params: Promise<{ id: string }> };


/**
 * GET /api/engagements/:id/emails-sent?itemId=pre-4 (GL-07): the emails people sent from this
 * project's cards, newest first, from the `email.sent` audit records. With `itemId`, only the
 * emails sent from that step. Staff only; the repository scopes the project to the caller.
 */
export async function GET(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const itemId = new URL(request.url).searchParams.get('itemId')?.trim() || null;
  try {
    const rows = await listAuditEvents(guard.ctx, { engagementId: id, action: 'email.sent', limit: 200 });
    const emails: SentEmailRow[] = rows
      .filter((r) => !itemId || r.metadata?.itemId === itemId)
      .slice(0, 10)
      .map((r) => ({
        at: r.created_at,
        by: r.actor_name || r.actor_email || 'Someone',
        to: Array.isArray(r.metadata?.to) ? (r.metadata.to as string[]) : [],
        subject: typeof r.metadata?.subject === 'string' ? r.metadata.subject : '',
      }));
    return NextResponse.json({ emails });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, 'list_failed') }, { status: 400 });
  }
}
