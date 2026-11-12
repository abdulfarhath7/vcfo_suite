'use client';

import { useCallback, useState } from 'react';
import { toastError } from '@/lib/toast-errors';
import { requestEmailSend, type EmailDraftView } from '@/lib/email/request-email-send';
import { sep } from '@/lib/date-format';

/**
 * "Remind" (G-15): `POST /api/engagements/:id/remind`. GL-07: the click opens the "Send email"
 * pop-up with the drafted reminder, and only its Send sends. Returns whether the reminder went
 * out, so a caller can fall back to its old path (Mail) on a real failure. A rate-limited item
 * is not a failure (the toast says when the next one can go), and Cancel is not one either.
 */

export type RemindOutcome = 'sent' | 'limited' | 'failed' | 'cancelled';

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return sep(
    d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
  );
}


/**
 * GL-07: one reminder through the "Send email" pop-up. The draft is read first, so a reminder
 * already sent today is reported as `limited` without opening the pop-up.
 */
export interface RemindInput {
  engagementId: string;
  itemKey: string;
  title: string;
  note?: string;
  /** DR-03: `step-opened` drafts the "step is open" email instead of the reminder. */
  purpose?: 'reminder' | 'step-opened';
}

export async function remindWithEmail(input: RemindInput, opts: { quiet?: boolean } = {}): Promise<RemindOutcome> {
  try {
    const url = `/api/engagements/${encodeURIComponent(input.engagementId)}/remind`;
    const payload = {
      itemKey: input.itemKey,
      ...(input.note ? { note: input.note } : {}),
      ...(input.purpose && input.purpose !== 'reminder' ? { purpose: input.purpose } : {}),
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, preview: true }),
    });
    const body = (await res.json().catch(() => ({}))) as { draft?: EmailDraftView; error?: string; retryAt?: string };
    if (res.ok && body.draft) {
      const heading = input.purpose === 'step-opened' ? `Email the client · ${input.title}` : `Remind the client · ${input.title}`;
      const outcome = await requestEmailSend({ url, body: payload, draft: body.draft, title: heading });
      return outcome.sent ? 'sent' : 'cancelled';
    }
    if (res.status === 429) {
      if (!opts.quiet) toastError('Already reminded today', body.retryAt ? `Next reminder from ${timeLabel(body.retryAt)}` : undefined);
      return 'limited';
    }
    if (!opts.quiet) toastError(input.purpose === 'step-opened' ? 'Could not prepare the email' : 'Could not send the reminder', body.error);
    return 'failed';
  } catch {
    if (!opts.quiet) toastError('Could not send the reminder');
    return 'failed';
  }
}

export function useRemindClient() {
  const [pending, setPending] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(() => new Set());

  const remind = useCallback(
    async (input: RemindInput): Promise<RemindOutcome> => {
      setPending(input.itemKey);
      try {
        const outcome = await remindWithEmail(input);
        if (outcome === 'sent' || outcome === 'limited') setSent((prev) => new Set(prev).add(input.itemKey));
        return outcome;
      } catch {
        toastError('Could not send the reminder');
        return 'failed';
      } finally {
        setPending(null);
      }
    },
    [],
  );

  return { remind, pending, sent };
}
