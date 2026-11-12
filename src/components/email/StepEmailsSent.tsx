'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import type { SentEmailRow } from '@/lib/email/sent-email';

/** Fired by the Send email pop-ups after a send, so the step's "Emailed" line refreshes. */
export const EMAIL_SENT_EVENT = 'vcfo:email-sent';

export function announceEmailSent(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EMAIL_SENT_EVENT));
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/**
 * GL-07: on a step card, who sent an email from this step, when, to whom and with what subject
 * (the newest three). Read from the `email.sent` audit records; staff only.
 */
export function StepEmailsSent({ engagementId, itemId }: { engagementId: string; itemId: string }) {
  const [emails, setEmails] = useState<SentEmailRow[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/emails-sent?itemId=${encodeURIComponent(itemId)}`, { cache: 'no-store' });
      if (res.ok) setEmails(((await res.json()) as { emails?: SentEmailRow[] }).emails ?? []);
    } catch {
      /* the line stays hidden */
    }
  }, [engagementId, itemId]);

  useEffect(() => {
    void load();
    const onSent = () => void load();
    window.addEventListener(EMAIL_SENT_EVENT, onSent);
    return () => window.removeEventListener(EMAIL_SENT_EVENT, onSent);
  }, [load]);

  if (!emails.length) return null;
  return (
    <section aria-label="Emails sent from this step" className="mt-4 rounded-lg border border-line bg-surface-raised px-4 py-3">
      <h3 className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
        <Mail className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
        Emails sent from this step
      </h3>
      <ul className="mt-2 space-y-1.5">
        {emails.slice(0, 3).map((e, i) => (
          <li key={`${e.at}-${i}`} className="text-[12.5px] text-ink-muted">
            <span className="text-ink">{e.by}</span> sent “{e.subject}” to {e.to.join(', ') || '—'}
            <span className="whitespace-nowrap"> · {when(e.at)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
