import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwnAccount } from '@/auth/guards';
import { getOwnNotificationPrefs, updateOwnNotificationPrefs } from '@/db/repositories/notification-prefs';
import { parseJsonBody } from '@/lib/api/parse-body';

const flags = z.record(z.string(), z.boolean());
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'invalid_time');

const patchSchema = z
  .object({
    email: flags.optional(),
    whatsapp: flags.optional(),
    quietHours: z.boolean().optional(),
    quietStart: clock.optional(),
    quietEnd: clock.optional(),
    /** Role alerts (P-627): approvalsWaiting, escalations. */
    alerts: flags.optional(),
    /** Reminder lead time; null is the firm default. */
    remindDays: z.union([z.literal(7), z.literal(3), z.literal(1), z.null()]).optional(),
    /** Daily digest time; null turns it off (P-626). */
    digestTime: z.union([clock, z.null()]).optional(),
  })
  .strict();

/**
 * GET /api/account/notification-prefs — the caller's own channels per category,
 * quiet hours and digest (staff Profile › Notifications, G-25). Same store as the
 * client route `/api/client/notification-prefs`.
 */
export async function GET() {
  const guard = await requireOwnAccount();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  return NextResponse.json({ prefs: await getOwnNotificationPrefs(guard.ctx) });
}

/** PATCH — partial. Email for documents, steps, deadlines and timeline stays on and cannot be switched off. */
export async function PATCH(request: Request) {
  const guard = await requireOwnAccount();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, patchSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: 400 });
  const prefs = await updateOwnNotificationPrefs(guard.ctx, body.data);
  return NextResponse.json({ prefs });
}
