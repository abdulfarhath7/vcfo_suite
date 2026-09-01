'use client';

import { CheckCircle2 } from 'lucide-react';
import { DashHero } from '@/components/dash/DashHero';
import { heroStateLine, type ClientOverview } from '@/lib/client-overview';
import {
  LEGAL_FORM_LABEL,
  formatClientDayMonth,
} from '@/components/client/overview/client-overview-format';

/**
 * Modules 1 + 3 — the client's greeting card, with the key numbers folded in.
 *
 * The card is the shared `DashHero`, identical to the lead, manager, admin and
 * super admin ones: clock line, settings, serif title, ring, stat strip. Only
 * the content differs — entity type on the top line, the plain-English status
 * under the title, and the four numbers in the strip rather than in separate
 * cards below.
 */
export function ClientOverviewHero({ overview }: { overview: ClientOverview }) {
  const { engagement, progress, ballInCourt, documents, compliance, incorporated } = overview;
  const nextFiling = compliance.upcoming[0];

  return (
    <DashHero
      title={engagement.companyName}
      meta={
        <>
          <span aria-hidden>·</span>
          <span>{LEGAL_FORM_LABEL[engagement.legalForm]}</span>
          {engagement.domesticOrForeign === 'foreign' && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
              Foreign parent
            </span>
          )}
        </>
      }
      subtitle={
        <>
          {incorporated && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          <span className="min-w-0">{heroStateLine(overview)}</span>
        </>
      }
      ring={{
        value: progress.overallPct,
        total: 100,
        caption: 'complete',
        display: `${progress.overallPct}%`,
      }}
      stats={[
        {
          label: 'Complete',
          value: `${progress.overallPct}%`,
          href: '/app/client/incorporation',
        },
        {
          label: 'Awaiting you',
          value: ballInCourt.waitingOnClient,
          href: '/app/client/incorporation',
          hot: ballInCourt.waitingOnClient > 0,
        },
        {
          label: 'Documents',
          value: documents.counts.delivered,
          href: '/app/client/documents',
        },
        {
          label: 'Next deadline',
          value: nextFiling ? formatClientDayMonth(nextFiling.dueDate) : '—',
          href: '/app/client/compliances',
        },
      ]}
    />
  );
}
