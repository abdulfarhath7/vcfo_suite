'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { TONE_BADGE } from '@/components/common/IconChip';
import {
  attentionReason,
  idleLabel,
  phaseFill,
  STATE_TONE,
} from '@/components/super/overview/super-overview-format';
import {
  SUPER_ATTENTION_HREF,
  type SuperEngagementSummary,
  type SuperOverview,
} from '@/lib/super-overview';
import { cn } from '@/lib/utils';

/**
 * What needs a human, most urgent first. This is the launchpad half of the
 * observatory: every row drills to the engagement behind it.
 *
 * Row anatomy is the lead dashboard's phase-progress row — company name, a
 * status chip pushed right, and the four-segment phase track underneath — so a
 * project reads the same here as it does on the lead's own dashboard.
 */
export function SuperAttentionPanel({ overview }: { overview: SuperOverview }) {
  const rows = overview.needsAttention;

  return (
    <DashSection
      icon={AlertTriangle}
      tone="danger"
      title="Needs attention"
      meta={`${overview.kpis.needsAttention} of ${overview.kpis.engagements}`}
      href={SUPER_ATTENTION_HREF}
    >
      {rows.length === 0 ? (
        <p className="py-3 text-center text-[12.5px] text-muted-foreground">
          Nothing is stuck. Every project is moving.
        </p>
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

  return (
    <Link
      href={summary.href}
      title={summary.companyName}
      className="border-t border-border py-2.5 first:border-t-0 first:pt-0.5 last:pb-0.5"
    >
      <div className="mb-1.5 flex min-w-0 items-center gap-2 text-[12.5px]">
        <b className="min-w-0 truncate font-extrabold text-ink">{summary.companyName}</b>
        {idle ? (
          <span className="shrink-0 font-mono text-[10.5px] font-semibold text-text-tertiary">
            {idle}
          </span>
        ) : null}
        <span
          className={cn(
            'ml-auto inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-extrabold',
            TONE_BADGE[STATE_TONE[summary.stateKey]],
          )}
        >
          {summary.stateLabel}
        </span>
      </div>

      <div className="flex h-2.5 gap-1">
        {summary.phases.map((phase) => (
          <div
            key={phase.id}
            className="relative overflow-hidden rounded-full bg-raised"
            style={{ flex: Math.max(phase.total, 1) }}
          >
            <i
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${phase.pct}%`, background: phaseFill(phase.id) }}
            />
          </div>
        ))}
      </div>

      <p className="mt-1.5 min-w-0 truncate text-[11.5px] font-semibold text-muted-foreground">
        {attentionReason(summary)}
        {summary.leadName ? ` · ${summary.leadName}` : ''}
      </p>
    </Link>
  );
}
