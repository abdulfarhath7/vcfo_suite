import { NextResponse } from 'next/server';
import { requireAdminOrManager } from '@/auth/guards';
import { getDeliveryForRetry } from '@/db/repositories/notification-deliveries';
import { queueWhatsAppSend } from '@/lib/notify/send-whatsapp';

type RouteContext = { params: Promise<{ id: string; deliveryId: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/engagements/:id/notification-deliveries/:deliveryId/retry
 *
 * Re-queues one failed WhatsApp send. Admin and manager only, scoped like the
 * Send log GET. A new dedupe id per attempt lets Inngest accept it; the job
 * re-reads consent, so a person who opted out since is still skipped.
 */
export async function POST(_request: Request, context: RouteContext) {
  const guard = await requireAdminOrManager();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id, deliveryId } = await context.params;
  if (!UUID.test(deliveryId)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const lookup = await getDeliveryForRetry(guard.ctx, id, deliveryId);
    if (lookup.ok === false) {
      return NextResponse.json(
        { error: lookup.error },
        { status: lookup.error === 'not_found' ? 404 : 409 },
      );
    }

    const { delivery } = lookup;
    await queueWhatsAppSend({
      engagementId: delivery.engagementId,
      recipientProfileId: delivery.recipientProfileId,
      event: delivery.event,
      variables: delivery.variables,
      dedupeId: `retry:${delivery.id}:${delivery.attempt}`,
      retryOf: delivery.id,
    });
    return NextResponse.json({ ok: true, attempt: delivery.attempt }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'retry_failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
