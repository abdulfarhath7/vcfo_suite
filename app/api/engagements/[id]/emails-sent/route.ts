import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { listSentEmails } from '@/db/repositories/sent-emails';
import { publicErrorMessage } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };


/**
 * GET /api/engagements/:id/emails-sent?itemId=pre-4 (GL-07): the emails people sent from this
 * project's cards, newest first, from the `email.sent` audit records. With `itemId`, only the
 * emails sent from that step (the newest ten); without it, the project's emails, so the step
 * cards can show the newest one each. Staff read the project in their scope; a client reads
 * only the emails sent to them (the repository scopes both).
 */
export async function GET(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern', 'client');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const itemId = new URL(request.url).searchParams.get('itemId')?.trim() || null;
  try {
    const emails = await listSentEmails(guard.ctx, { engagementId: id, itemId, limit: itemId ? 10 : 200 });
    return NextResponse.json({ emails });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, 'list_failed') }, { status: 400 });
  }
}
