'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail } from 'lucide-react';
import { latestSentEmailByItem, type SentEmailRow } from '@/lib/email/sent-email';
import { cn } from '@/lib/utils';

/** Fired by the Send email pop-ups after a send, so the step's "Emailed" line refreshes. */
export const EMAIL_SENT_EVENT = 'vcfo:email-sent';

export function announceEmailSent(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EMAIL_SENT_EVENT));
}

export function sentWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/**
 * GL-07: the emails sent from a project's cards (`GET /api/engagements/:id/emails-sent`), newest
 * first; with `itemId`, only that step's. Reloads after every send in this tab. The route scopes
 * the list: a client gets only the emails sent to them.
 */
export function useSentEmails(engagementId: string | null | undefined, itemId?: string | null): SentEmailRow[] {
  const [emails, setEmails] = useState<SentEmailRow[]>([]);

  const load = useCallback(async () => {
    if (!engagementId) return;
    try {
      const query = itemId ? `?itemId=${encodeURIComponent(itemId)}` : '';
      const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/emails-sent${query}`, { cache: 'no-store' });
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

  return emails;
}

/** GL-07: the newest email sent from each step of a project, for the step cards. */
export function useLatestSentEmailByStep(engagementId: string | null | undefined): Map<string, SentEmailRow> {
  const emails = useSentEmails(engagementId);
  return useMemo(() => latestSentEmailByItem(emails), [emails]);
}

/** The words of one sent-email line: "Asha sent “Subject” to a@b.in · 12 Nov, 3:05 pm". */
export function sentEmailText(e: SentEmailRow): string {
  const to = e.to.join(', ') || '—';
  const when = sentWhen(e.at);
  return `${e.by} sent “${e.subject}” to ${to}${when ? ` · ${when}` : ''}`;
}

/** GL-07: one compact line on a step card: who emailed from the step, when, to whom, the subject. */
export function StepEmailSentLine({ email, className }: { email: SentEmailRow; className?: string }) {
  const text = sentEmailText(email);
  return (
    <span className={cn('flex min-w-0 items-center gap-1 text-[12px] text-ink-muted', className)} data-step-email-sent title={text}>
      <Mail className="h-3 w-3 flex-none" aria-hidden />
      <span className="truncate">
        <span className="sr-only">Last email: </span>
        {text}
      </span>
    </span>
  );
}

/**
 * GL-07: on a step page, who sent an email from this step, when, to whom and with what subject
 * (the newest three). Read from the `email.sent` audit records; a client sees only the emails
 * sent to them, with the sender's first name (or "Admin").
 */
export function StepEmailsSent({
  engagementId,
  itemId,
  title = 'Emails sent from this step',
}: {
  engagementId: string;
  itemId: string;
  title?: string;
}) {
  const emails = useSentEmails(engagementId, itemId);
  if (!emails.length) return null;
  return (
    <section aria-label={title} className="mt-4 rounded-lg border border-line bg-surface-raised px-4 py-3">
      <h3 className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
        <Mail className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
        {title}
      </h3>
      <ul className="mt-2 space-y-1.5">
        {emails.slice(0, 3).map((e, i) => (
          <li key={`${e.at}-${i}`} className="text-[12.5px] text-ink-muted">
            <span className="text-ink">{e.by}</span> sent “{e.subject}” to {e.to.join(', ') || '—'}
            <span className="whitespace-nowrap"> · {sentWhen(e.at)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
