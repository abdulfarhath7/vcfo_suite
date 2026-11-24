import { inngest } from './client';
import { getItem } from '@/data/checklist';
import { systemAskedFieldsBetween, systemOpenFieldAsks } from '@/db/repositories/step-field-states';
import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';
import { createNotificationsForUsers, systemRecentNotificationsForUsers } from '@/db/repositories/notifications';
import { sendEmail } from '@/lib/email/send-email';
import { siteUrl } from '@/lib/site-url';
import { stepPathForRole } from '@/lib/projects/project-step-path';
import {
  FIELDS_ASKED_EVENT,
  FIELD_REMINDER_WINDOW_MS,
  buildFieldAskEmail,
  fieldAskBell,
  splitOpenFields,
  stepsDueForReminder,
  type FieldAskEventData,
  type FieldAskKind,
} from '@/lib/steps/field-ask-email';
import { PAUSED, skipWhenPaused, withRunNow } from '@/jobs/dev-controls';

/**
 * FIELD ASK EMAILS: what the client receives when staff ask for fields on a step page.
 *
 * `fieldAskDelivery` runs on `client/fields.asked`, sent after "Ask client", "Reject" (send
 * back) and "Send reminder". The event is debounced for two minutes per step, so a lead who asks
 * for five fields in a row sends one email. The job reads the step's open asks again, so the
 * email always lists what is still waiting: fields asked ("Please fill in") and fields sent back
 * ("Please correct"). Every client member gets the email (`sendEmail`, the system of record) and
 * a bell that opens the client step page. There is no WhatsApp for these yet.
 *
 * `fieldAskReminders` runs every morning at 09:00 India time and re-sends the step email as a
 * reminder for fields still asked 3 and 7 days after `asked_at`.
 *
 * A reminder, whether a person or the daily run sent it, goes out at most once per step per 24
 * hours. The check reads the client's own reminder bells (no extra table). Both functions return
 * early while "Pause all jobs" is on. Registered in app/api/inngest/route.ts and the jobs registry.
 */

const BOARD_RESOLUTION_STEPS = new Set(['pre-2', 'pre-3']);

/** Sends one step's email and bell. Returns what happened, for the run log. */
async function deliverStep(engagementDbId: string, itemId: string, kind: FieldAskKind): Promise<'sent' | 'none_open' | 'no_client' | 'recent'> {
  const item = getItem(itemId);
  if (!item) return 'none_open';
  const open = await systemOpenFieldAsks(engagementDbId, itemId);
  if (open.length === 0) return 'none_open';
  const recipients = await resolveEngagementRecipients(engagementDbId);
  const clients = recipients ? (recipients.clients.length > 0 ? recipients.clients : recipients.client ? [recipients.client] : []) : [];
  if (!recipients || clients.length === 0) return 'no_client';

  if (kind === 'remind') {
    const since = new Date(Date.now() - FIELD_REMINDER_WINDOW_MS);
    const recent = await systemRecentNotificationsForUsers(
      clients.map((c) => c.userId),
      since,
    );
    const already = recent.some(
      (n) => n.kind === 'request.created' && n.itemId === itemId && n.engagementId === recipients.appId && n.title.startsWith('Reminder'),
    );
    if (already) return 'recent';
  }

  const { asked, correct } = splitOpenFields(itemId, open);
  const path = stepPathForRole('client', { id: recipients.appId, slug: recipients.slug }, itemId, {
    boardResolution: BOARD_RESOLUTION_STEPS.has(itemId),
  });
  const href = `${siteUrl()}${path}`;

  for (const party of clients) {
    const copy = buildFieldAskEmail({
      kind,
      recipientName: party.name,
      companyName: recipients.companyName,
      stepTitle: item.title,
      asked,
      correct,
      href,
    });
    await sendEmail({
      to: party.email,
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
      purpose: kind === 'remind' ? 'step.fields_reminder' : 'step.fields_asked',
    }).catch((err: unknown) => {
      console.warn('[field-ask] email failed', err instanceof Error ? err.message : err);
    });
  }

  const bell = fieldAskBell({ kind, stepTitle: item.title, asked, correct });
  await createNotificationsForUsers(
    clients.map((c) => ({
      userId: c.userId,
      kind: 'request.created' as const,
      title: bell.title,
      body: bell.body,
      engagementId: recipients.appId,
      companyName: recipients.companyName,
      itemId,
      href: path,
    })),
  ).catch((err: unknown) => console.warn('[field-ask] bell failed', err instanceof Error ? err.message : err));
  return 'sent';
}

export const fieldAskDelivery = inngest.createFunction(
  {
    id: 'field-ask-delivery',
    debounce: { key: 'event.data.engagementDbId + "-" + event.data.itemId', period: '2m' },
  },
  { event: FIELDS_ASKED_EVENT },
  async ({ event, step }) => {
    if (await skipWhenPaused(step)) return PAUSED;
    const data = event.data as unknown as FieldAskEventData;
    if (!data?.engagementDbId || !data?.itemId) return { skipped: 'bad_event' };
    const result = await step.run('deliver', () => deliverStep(data.engagementDbId, data.itemId, data.kind === 'remind' ? 'remind' : 'ask'));
    return { result };
  },
);

export const fieldAskReminders = inngest.createFunction(
  { id: 'field-ask-reminders' },
  withRunNow('field-ask-reminders', 'TZ=Asia/Kolkata 0 9 * * *'),
  async ({ step }) => {
    if (await skipWhenPaused(step)) return PAUSED;
    const due = (await step.run('due', async () => {
      const now = new Date();
      // Day 7 in India time can sit up to eight whole days back; day 3 at least two.
      const rows = await systemAskedFieldsBetween(new Date(now.getTime() - 9 * 86_400_000), new Date(now.getTime() - 2 * 86_400_000));
      return stepsDueForReminder(rows, now);
    })) as Array<{ engagementDbId: string; itemId: string }>;

    let sent = 0;
    for (const s of due) {
      const r = await step.run(`remind-${s.engagementDbId}-${s.itemId}`, () => deliverStep(s.engagementDbId, s.itemId, 'remind'));
      if (r === 'sent') sent += 1;
    }
    return { due: due.length, sent };
  },
);
