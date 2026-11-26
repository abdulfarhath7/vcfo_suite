'use client';

import { BellRing } from 'lucide-react';
import { Tag } from '@/components/ui/spectrum-chip';
import { useGstNotices } from '@/hooks/use-gstzen';
import { cn } from '@/lib/utils';

/**
 * GST NOTICES — the notices the daily watcher read through GSTZen for an engagement's GSTIN (staff
 * only), open first. Shown on the GST return card agent and on the GST registration record. Hidden
 * while there are none. The reply stays with the person: the notice and its documents are read on the
 * GST portal, the reply is drafted in Suite and uploaded by them.
 */
export function GstNoticesSection({ engagementId, className, limit = 6 }: { engagementId: string | null | undefined; className?: string; limit?: number }) {
  const q = useGstNotices(engagementId);
  const rows = q.data ?? [];
  if (q.isLoading || q.isError || rows.length === 0) return null;
  const openCount = rows.filter((n) => n.state === 'open').length;
  return (
    <section aria-label="GST notices" className={cn('grid gap-2', className)}>
      <h4 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
        <BellRing className="h-3.5 w-3.5" aria-hidden />
        GST notices
        {openCount ? <Tag tone="warn">{`${openCount} open`}</Tag> : null}
      </h4>
      <ul className="grid gap-1.5">
        {rows.slice(0, limit).map((n) => (
          <li key={n.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13px]">
            <span className="font-medium">{n.noticeType ?? 'Notice'}</span>
            <span className="font-mono text-[12px] text-ink-muted">{n.refId}</span>
            {n.issuedOn ? <span className="text-ink-muted">issued {fmtDate(n.issuedOn)}</span> : null}
            {n.dueOn && n.state === 'open' ? <span className="text-warning">reply by {fmtDate(n.dueOn)}</span> : null}
            {n.period ? <span className="text-ink-muted">period {n.period}</span> : null}
            <span className="text-ink-muted">{n.state === 'open' ? 'Open' : n.state === 'replied' ? 'Replied' : 'Closed'}</span>
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-ink-muted">Read the notice and its documents on the GST portal. The reply is drafted in Suite and filed by you.</p>
    </section>
  );
}

const DATE = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
function fmtDate(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? DATE.format(new Date(`${iso}T00:00:00Z`)) : iso;
}
