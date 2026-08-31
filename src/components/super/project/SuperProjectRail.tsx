'use client';

import Link from 'next/link';
import { Activity, CalendarClock, ExternalLink, Scale, Users } from 'lucide-react';
import { DashDonut, DashLegendRow, DashSection } from '@/components/dash/DashSection';
import { CHART_STATUS } from '@/components/charts';
import { TONE_BADGE } from '@/components/common/IconChip';
import {
  FILING_TONE,
  formatSuperAgo,
  formatSuperDayMonth,
} from '@/components/super/overview/super-overview-format';
import type { SuperEngagementDetail } from '@/lib/super-overview';
import { cn } from '@/lib/utils';

/**
 * The detail screen's rail — same 318px column, same panel anatomy as the
 * Overview's rail and the lead dashboard's.
 */
export function SuperProjectRail({ detail }: { detail: SuperEngagementDetail }) {
  return (
    <div className="flex flex-col gap-3">
      <BallInCourtPanel detail={detail} />
      <InspectPanel detail={detail} />
      <FilingsPanel detail={detail} />
      <TeamPanel detail={detail} />
      <ActivityPanel detail={detail} />
    </div>
  );
}

function BallInCourtPanel({ detail }: { detail: SuperEngagementDetail }) {
  const { steps, ballInCourt } = detail.summary;
  const open = ballInCourt.firm + ballInCourt.client;

  return (
    <DashSection icon={Scale} tone="primary" title="Ball in court" meta={`${open} open`}>
      <div className="flex min-w-0 items-center gap-3">
        <DashDonut
          segments={[
            { n: ballInCourt.firm, color: CHART_STATUS.active },
            { n: ballInCourt.client, color: CHART_STATUS.waiting },
            { n: steps.done, color: CHART_STATUS.done },
            { n: steps.locked, color: CHART_STATUS.locked },
          ]}
          centerLabel={detail.summary.progress.pct}
          centerCaption="% done"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <DashLegendRow swatchClassName="bg-primary" label="With the firm" count={ballInCourt.firm} />
          <DashLegendRow swatchClassName="bg-accent-orange" label="With the client" count={ballInCourt.client} />
          <DashLegendRow swatchClassName="bg-success" label="Done" count={steps.done} />
          <DashLegendRow swatchClassName="bg-muted-foreground" label="Not open yet" count={steps.locked} />
        </div>
      </div>
    </DashSection>
  );
}

/**
 * Enter-as, the read-only way: plain links into the role shells. No
 * impersonation and no role swap, so nothing role-scoped can be mutated
 * through them (context §6).
 */
function InspectPanel({ detail }: { detail: SuperEngagementDetail }) {
  const links = [
    { href: detail.enterAs.firm, label: 'Firm project view', hint: 'Steps, approvals, documents' },
    { href: detail.enterAs.client, label: 'Client portal', hint: 'What the client sees' },
  ];

  return (
    <DashSection icon={ExternalLink} tone="violet" title="Inspect as" meta="read-only">
      <div className="flex flex-col gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex min-w-0 items-center gap-3 rounded-xl border border-border/70 bg-panel p-2.5 transition-colors hover:border-primary/40 hover:bg-primary-light/40"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold text-ink">{link.label}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{link.hint}</span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </div>
    </DashSection>
  );
}

function FilingsPanel({ detail }: { detail: SuperEngagementDetail }) {
  const filings = detail.filings.slice(0, 6);

  return (
    <DashSection
      icon={CalendarClock}
      tone="cyan"
      title="Compliance"
      meta={detail.filings.length === 0 ? undefined : `${detail.filings.length} in window`}
    >
      {filings.length === 0 ? (
        <p className="py-3 text-center text-[12.5px] text-muted-foreground">
          No filings in the next 90 days.
        </p>
      ) : (
        <ul className="flex flex-col">
          {filings.map((filing) => (
            <li key={filing.id} className="flex min-w-0 items-center gap-2.5 border-t border-border py-2 first:border-t-0 first:pt-0.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-[11px] font-extrabold tabular-nums text-ink">
                {filing.dueDate.slice(8, 10)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-ink">{filing.title}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {filing.authority} · {formatSuperDayMonth(filing.dueDate)}
                </span>
              </span>
              <span
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-extrabold',
                  TONE_BADGE[FILING_TONE[filing.status] ?? 'neutral'],
                )}
              >
                {filing.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashSection>
  );
}

function TeamPanel({ detail }: { detail: SuperEngagementDetail }) {
  return (
    <DashSection icon={Users} tone="teal" title="Team" meta={detail.team.length || undefined}>
      {detail.team.length === 0 ? (
        <p className="py-3 text-center text-[12.5px] text-muted-foreground">Nobody assigned yet.</p>
      ) : (
        <ul className="flex flex-col">
          {detail.team.map((member) => (
            <li key={member.id} className="min-w-0 border-t border-border py-2 first:border-t-0 first:pt-0.5">
              <p className="min-w-0 truncate text-[12.5px] font-extrabold leading-tight text-ink">
                {member.name}
              </p>
              <p className="min-w-0 truncate text-[11px] leading-tight text-muted-foreground">
                {member.role} · {member.email}
              </p>
            </li>
          ))}
        </ul>
      )}
    </DashSection>
  );
}

function ActivityPanel({ detail }: { detail: SuperEngagementDetail }) {
  const entries = detail.activity.slice(0, 10);

  return (
    <DashSection icon={Activity} tone="violet" title="Activity" href="/app/admin/audit-log" hrefLabel="Full log">
      {entries.length === 0 ? (
        <p className="py-3 text-center text-[12.5px] text-muted-foreground">
          Nothing has happened on this project yet.
        </p>
      ) : (
        <ul className="flex flex-col">
          {entries.map((entry) => (
            <li key={entry.id} className="min-w-0 border-t border-border py-2 first:border-t-0 first:pt-0.5">
              <p className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-ink">
                {entry.label}
              </p>
              <p className="mt-0.5 min-w-0 truncate text-[11px] text-muted-foreground">
                {entry.actor ?? 'System'}
                <span className="ml-1.5 font-mono text-[10.5px] text-text-tertiary">
                  {formatSuperAgo(entry.at)}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </DashSection>
  );
}
