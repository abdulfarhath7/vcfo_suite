'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { Chip } from '@/components/ui/spectrum-chip';
import { PhaseBar } from '@/components/ui/step-track';
import { ClientTile } from '@/components/super/parts/super-parts';
import {
  attentionReason,
  idleLabel,
  superPhaseTrack,
  superStateChip,
} from '@/components/super/overview/super-overview-format';
import {
  SUPER_ATTENTION_HREF,
  type SuperEngagementSummary,
  type SuperOverview,
} from '@/lib/super/super-overview';
import { cn } from '@/lib/utils';

/**
 * What needs a human, most urgent first. This is the launchpad half of the
 * observatory: every row drills to the engagement behind it.
 *
 * Row anatomy follows the prototype's attention list: the client tile, the name
 * with the reason under it, the ST5 phase bars and the status chip on the right.
 * An overdue row is tinted soft red (R-20).
 */
export function SuperAttentionPanel({ overview }: { overview: SuperOverview }) {
  const rows = overview.needsAttention;

  return (
    <DashSection
      icon={AlertTriangle}
      tone="danger"
      title="Clients needing attention"
      meta={`${overview.kpis.needsAttention} of ${overview.kpis.engagements}`}
      href={SUPER_ATTENTION_HREF}
      bodyClassName="p-0"
    >
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-center text-[13px] text-ink-muted">Nothing is stuck</p>
      ) : (
        <div className="flex flex-col">
          {rows.map((summary) => (
            <AttentionRow key={summary.id} summary={summary} />
          ))}
        </div>
      )}
    </DashSection>
  );
}

function AttentionRow({ summary }: { summary: SuperEngagementSummary }) {
  const idle = idleLabel(summary);
  const chip = superStateChip(summary);
  const track = superPhaseTrack(summary);
  const urgent = summary.stateKey === 'overdue';

  return (
    <Link
      href={summary.href}
      title={summary.companyName}
      className={cn(
        'flex min-w-0 items-center gap-3 border-t border-line-soft px-4 py-3 first:border-t-0 hover:bg-surface-sunken/60',
        urgent && 'bg-danger-soft/50',
      )}
    >
      <ClientTile id={summary.id} name={summary.companyName} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <b className="min-w-0 truncate text-[13.5px] font-medium text-ink">{summary.companyName}</b>
          {idle ? <span className="shrink-0 text-[12px] tabular-nums text-ink-faint">{idle}</span> : null}
        </span>
        <span className="block min-w-0 truncate text-[12.5px] text-ink-muted">
          {attentionReason(summary)}
          {summary.leadName ? ` · ${summary.leadName}` : ''}
        </span>
      </span>
      <PhaseBar done={track.done} totals={track.totals} names={track.names} className="hidden w-24 flex-none sm:flex" />
      <Chip fixed tone={chip.tone} title={chip.title} className="flex-none">
        {chip.word}
      </Chip>
    </Link>
  );
}
