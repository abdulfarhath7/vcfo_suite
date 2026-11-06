import 'server-only';

import { z } from 'zod';
import { lastReminderWithinWindow, resolveReminderTarget } from '@/db/repositories/client-reminders';
import { itemKeySchema } from '@/lib/messages/schemas';
import { sendClientReminder } from '@/lib/reminders/send-client-reminder';
import { clientRecipients, lockedClient, recordDraft, refusing, STAFF_ROLES } from '../shared';
import { defineAction, type AnyAction } from '../types';

/** The one-click reminder, through `sendClientReminder` and its 24-hour rule. */

const input = z.object({ itemKey: itemKeySchema, note: z.string().trim().max(1000).optional() });

const draft = defineAction({
  name: 'reminders.draft',
  label: 'Checking the reminder',
  description: 'Check a reminder before proposing it: which item it is about, who would receive it, and whether one already went out in the last 24 hours. Sends nothing and saves nothing.',
  input,
  tier: 'T1',
  roles: STAFF_ROLES,
  common: true,
  preview: async () => null,
  execute: (actx, { itemKey, note }) =>
    refusing(async () => {
      const engagementId = lockedClient(actx);
      const resolved = await resolveReminderTarget(actx.auth, engagementId, itemKey);
      if (resolved.ok === false) return { ok: false, error: 'This item cannot be reminded.' };
      const last = await lastReminderWithinWindow(actx.auth, resolved.target, actx.now);
      const to = (await clientRecipients(engagementId)).map((person) => person.name);
      return { ok: true, summary: JSON.stringify({ item: resolved.target.itemTitle, to, note: note ?? null, alreadySentAt: last?.toISOString() ?? null }) };
    }),
});

const sendClient = defineAction({
  name: 'reminders.sendClient',
  description: 'Propose reminding the client about one item they owe: email first, then WhatsApp where they opted in. itemKey comes from tasks.list or requests.list. A person confirms it on a card that lists the recipients.',
  input,
  tier: 'T3',
  roles: STAFF_ROLES,
  common: true,
  examples: [{ itemKey: 'request:7a1f0c52-3b64-4d2e-9f10-2c5b8e6d4a11', note: 'We need this to file by Friday.' }],
  preview: async (actx, value) => {
    const engagementId = lockedClient(actx);
    const resolved = await resolveReminderTarget(actx.auth, engagementId, value.itemKey);
    return recordDraft(actx, {
      action: 'reminders.sendClient',
      tier: 'T3',
      title: 'Remind the client',
      label: resolved.ok ? resolved.target.itemTitle : 'Reminder',
      target: value,
      displayNew: value.note ?? 'The standard reminder',
      recipients: await clientRecipients(engagementId),
    });
  },
  execute: (actx, value) =>
    refusing(async () => {
      const result = await sendClientReminder(actx.auth, lockedClient(actx), value, actx.now);
      if (result.ok === false) return { ok: false, error: result.error };
      return { ok: true, summary: `Reminder sent by ${result.channels.join(' and ')}.` };
    }),
});

export const actions: AnyAction[] = [draft, sendClient];
