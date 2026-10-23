import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { reviewRegulatoryUpdate, systemGetAskDocument } from '@/db/repositories/ask-documents';
import { notifyEveryoneOfApprovedUpdate } from '@/lib/regulatory/notify';
import { feedLabel } from '@/lib/ask/feeds/registry';
import { AskForbiddenError } from '@/lib/ask/access';
import { parseJsonBody } from '@/lib/api/parse-body';

const bodySchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(2000).optional(),
});

/**
 * POST /api/regulatory-updates/[id] — { decision: "approve" | "reject", note? }
 * Managers only (owner, 2026-10-23). Approve → Ask VCFO may use it for staff
 * and clients, an announcement is posted, clients and staff are notified.
 * Reject → stays hidden with the manager's reason.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAnyRole('manager');
  if (gate.ok === false) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  if (body.data.decision === 'reject' && !body.data.note?.trim()) {
    return NextResponse.json({ error: 'Say why you are rejecting it, so the fetching can be fixed.' }, { status: 400 });
  }
  try {
    const row = await reviewRegulatoryUpdate(gate.ctx, id, body.data.decision, body.data.note ?? null);
    if (body.data.decision === 'approve') {
      const doc = await systemGetAskDocument(id);
      if (doc) {
        // Telling people is best effort; the approval itself already stands.
        notifyEveryoneOfApprovedUpdate(doc).catch((error) => console.error('[regulatory-updates] approval notices failed', id, error));
      }
    }
    return NextResponse.json({ update: { ...row, feed: feedLabel(row.feedId) } });
  } catch (error) {
    if (error instanceof AskForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    const message = error instanceof Error ? error.message : 'Could not record the decision';
    return NextResponse.json({ error: message }, { status: message.includes('not waiting') ? 409 : 500 });
  }
}
