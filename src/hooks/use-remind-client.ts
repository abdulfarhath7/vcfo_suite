'use client';

import { useCallback, useState } from 'react';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { sep } from '@/lib/date-format';

/**
 * One-click "Remind" (G-15): `POST /api/engagements/:id/remind`. Returns whether the
 * reminder went out, so a caller can fall back to its old path (Mail) on a real failure.
 * A rate-limited item is not a failure: the toast says when the next one can go.
 */

export type RemindOutcome = 'sent' | 'limited' | 'failed';

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return sep(
    d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
  );
}

export function useRemindClient() {
  const [pending, setPending] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(() => new Set());

  const remind = useCallback(
    async (input: { engagementId: string; itemKey: string; title: string; note?: string }): Promise<RemindOutcome> => {
      setPending(input.itemKey);
      try {
        const res = await fetch(`/api/engagements/${encodeURIComponent(input.engagementId)}/remind`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemKey: input.itemKey, ...(input.note ? { note: input.note } : {}) }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          channels?: string[];
          error?: string;
          retryAt?: string;
        };
        if (res.ok) {
          setSent((prev) => new Set(prev).add(input.itemKey));
          const by = body.channels?.includes('whatsapp') ? 'Email and WhatsApp' : 'Email';
          toastSuccess(`Reminder sent · ${input.title}`, by, { id: `remind:${input.itemKey}` });
          return 'sent';
        }
        if (res.status === 429) {
          setSent((prev) => new Set(prev).add(input.itemKey));
          toastError(
            'Already reminded today',
            body.retryAt ? `Next reminder from ${timeLabel(body.retryAt)}` : undefined,
          );
          return 'limited';
        }
        toastError('Could not send the reminder', body.error);
        return 'failed';
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
