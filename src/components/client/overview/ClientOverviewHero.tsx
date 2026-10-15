'use client';

import type { ComponentType, CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { CalendarClock, CheckCircle2, ClipboardList, FileDown, FileText, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { heroStateLine, type ClientOverview } from '@/lib/client-overview';
import {
  LEGAL_FORM_LABEL,
  formatClientDayMonth,
  relativeDayLabel,
} from '@/components/client/overview/client-overview-format';
import { ClientStepsDrill } from '@/components/client/overview/ClientStepsDrill';
import { ProgressRing } from '@/components/client/overview/ProgressRing';

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;

const KPI_CLASS =
  'client-kpi client-rise flex min-w-0 items-center gap-3 px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40';

function kpiStyle(hue: string, rise: number): CSSProperties {
  return { '--kpi': hue, '--rise': rise } as CSSProperties;
}

function KpiFace({
  icon: IconComponent,
  value,
  label,
  caption,
  live = false,
}: {
  icon: Icon;
  value: ReactNode;
  label: string;
  caption?: string;
  live?: boolean;
}) {
  return (
    <>
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[oklch(var(--kpi)/0.14)] text-[oklch(var(--kpi))]">
        <IconComponent className="h-[18px] w-[18px]" strokeWidth={1.9} />
        {live ? (
          <span className="client-live absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-panel bg-[oklch(var(--kpi))]" aria-hidden />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block text-[20px] font-bold leading-none tabular-nums text-foreground">{value}</span>
        <span className="mt-1 block truncate text-[11.5px] font-semibold text-muted-foreground">{label}</span>
        {caption ? (
          <span className="block truncate text-[11px] font-medium text-[oklch(var(--kpi))]">{caption}</span>
        ) : null}
      </span>
    </>
  );
}

/**
 * The home banner: who the company is, how far along it is, and the four
 * numbers a client checks first. Step counts open the steps drill-down;
 * documents and the next deadline go to the page that owns them.
 */
export function ClientOverviewHero({
  overview,
  aside,
}: {
  overview: ClientOverview;
  aside?: ReactNode;
}) {
  const { engagement, progress, ballInCourt, documents, compliance, incorporated, milestones } = overview;
  const nextFiling = compliance.upcoming[0];
  const stateLine = heroStateLine(overview);

  return (
    <section>
      <div className="client-hero rounded-t-xl px-5 pb-5 pt-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold">
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/90 ring-1 ring-white/15">
                {LEGAL_FORM_LABEL[engagement.legalForm]}
              </span>
              {engagement.domesticOrForeign === 'foreign' ? (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/90 ring-1 ring-white/15">
                  Foreign parent
                </span>
              ) : null}
            </p>
            <h1 className="mt-2 min-w-0 break-words text-[26px] font-bold leading-tight tracking-tight text-white">
              {engagement.companyName}
            </h1>
            {stateLine ? (
              <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[13.5px] leading-snug text-white/80">
                {incorporated ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[oklch(85%_0.12_165)]" aria-hidden /> : null}
                <span className="min-w-0">{stateLine}</span>
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={`/api/client/report?${new URLSearchParams({ engagementId: engagement.id })}`}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[13px] font-semibold text-white ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <FileDown className="h-4 w-4" aria-hidden />
                Report
              </a>
              {aside}
            </div>
          </div>

          <ClientStepsDrill
            milestones={milestones}
            trigger={
              <button
                type="button"
                aria-label={`${progress.done} of ${progress.total} steps complete. Show steps`}
                className="group flex shrink-0 items-center gap-3 rounded-2xl bg-white/10 p-2 pr-4 ring-1 ring-white/15 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <ProgressRing
                  pct={progress.overallPct}
                  size={88}
                  stroke={9}
                  color="oklch(82% 0.14 175)"
                  track="oklch(100% 0 0 / 0.14)"
                  label={`${progress.overallPct}% complete`}
                >
                  <span className="block text-center text-[22px] font-bold leading-none tabular-nums text-white">
                    {progress.overallPct}%
                  </span>
                </ProgressRing>
                <span className="text-left">
                  <span className="block text-[12px] font-semibold uppercase tracking-wider text-white/65">Overall</span>
                  <span className="block text-[15px] font-bold tabular-nums text-white">
                    {progress.done} / {progress.total} steps
                  </span>
                  <span className="block text-[11.5px] font-medium text-white/70 group-hover:text-white">See every step →</span>
                </span>
              </button>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-5 py-4 lg:grid-cols-4">
        <ClientStepsDrill
          milestones={milestones}
          initialTab="active"
          trigger={
            <button
              type="button"
              className={KPI_CLASS}
              style={kpiStyle('var(--primary)', 1)}
              aria-label={`Awaiting you: ${ballInCourt.waitingOnClient}. Show steps`}
            >
              <KpiFace
                icon={ClipboardList}
                value={ballInCourt.waitingOnClient}
                label="Awaiting you"
                caption={ballInCourt.waitingOnClient > 0 ? 'Your move' : 'All clear'}
                live={ballInCourt.waitingOnClient > 0}
              />
            </button>
          }
        />
        <ClientStepsDrill
          milestones={milestones}
          initialTab="waiting"
          trigger={
            <button
              type="button"
              className={KPI_CLASS}
              style={kpiStyle('var(--warning)', 2)}
              aria-label={`With the team: ${ballInCourt.waitingOnFirm}. Show steps`}
            >
              <KpiFace icon={Users} value={ballInCourt.waitingOnFirm} label="With the team" caption="We’re on it" />
            </button>
          }
        />
        <Link href="/app/client/documents" className={KPI_CLASS} style={kpiStyle('var(--accent-violet)', 3)}>
          <KpiFace
            icon={FileText}
            value={documents.counts.delivered}
            label="Documents"
            caption={documents.counts.requested > 0 ? `${documents.counts.requested} requested` : 'Issued to you'}
          />
        </Link>
        <Link
          href={
            nextFiling
              ? `/app/client/compliances/calendar?date=${nextFiling.dueDate.slice(0, 10)}`
              : '/app/client/compliances'
          }
          className={cn(KPI_CLASS)}
          style={kpiStyle(nextFiling ? 'var(--danger)' : 'var(--accent-orange)', 4)}
        >
          <KpiFace
            icon={CalendarClock}
            value={nextFiling ? formatClientDayMonth(nextFiling.dueDate) : '—'}
            label="Next deadline"
            caption={nextFiling ? `${nextFiling.title} · ${relativeDayLabel(nextFiling.dueDate)}` : 'Nothing due'}
          />
        </Link>
      </div>
    </section>
  );
}
