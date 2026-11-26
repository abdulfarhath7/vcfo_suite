'use client';

import { useMemo, useState } from 'react';
import { Clock, Download, FileCheck2, Wand2, Wrench } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { DashHero } from '@/components/dash/DashHero';
import { DashSection } from '@/components/dash/DashSection';
import { CHART_STATUS, DashBarChart, type ChartSeries } from '@/components/charts';
import { Button } from '@/components/ui/button';
import { EmptyState, SkeletonRows } from '@/components/ui/empty-state';
import { FilterSelect } from '@/components/ui/native-select';
import { useApp } from '@/context/AppContext';
import { useAgentResults } from '@/hooks/use-agent-runs';
import { isFirmWideAdmin } from '@/lib/auth';
import { downloadCsv } from '@/lib/compliance/spectrum-status';
import { agentResultsCsv, currentMonth, monthLabel, previousMonth, topWithOthers, type AgentResults } from '@/lib/card-agents/overview';

/**
 * AGENT RESULTS (docs/specs/live-portal-browser/MASTER-PLAN.md screen 11), admin and super admin
 * only. The month's headline numbers sit in the home card (filings, hours saved, fields auto-filled,
 * recipe breaks); below are filings by agent, the time per filing before and after, the cost lines
 * and a CSV of every filing. The manual minutes come from `src/lib/card-agents/minutes-saved.ts`
 * and every figure built on them is labelled an estimate. GSTZen has no price yet, so its cost line
 * is a count of filings.
 */

const SERIES_FILINGS: ChartSeries[] = [{ key: 'count', label: 'Filings', color: CHART_STATUS.active }];
const SERIES_MINUTES: ChartSeries[] = [{ key: 'minutes', label: 'Minutes per filing', color: CHART_STATUS.active }];

/** The last twelve months, newest first, for the month picker. */
function monthOptions(now: Date): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  let m = currentMonth(now);
  for (let i = 0; i < 12; i += 1) {
    out.push({ value: m, label: monthLabel(m) });
    m = previousMonth(m);
  }
  return out;
}

function CostLine({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t border-line-soft px-4 py-3 first:border-t-0 md:px-5">
      <span className="text-[13.5px] font-medium text-ink">{label}</span>
      <span className="text-right">
        <span className="block text-[14px] tabular-nums text-ink">{value}</span>
        <span className="block text-[12px] text-ink-muted">{note}</span>
      </span>
    </div>
  );
}

/** The chart's numbers as a small table under it, so every value reads without hovering (and in print). */
function ChartValues({ rows, unit, caption }: { rows: Array<{ name: string; value: number }>; unit: string; caption: string }) {
  if (rows.length === 0) return null;
  return (
    <table className="mt-3 w-full text-[12.5px]">
      <caption className="sr-only">{caption}</caption>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name} className="border-t border-line-soft first:border-t-0">
            <th scope="row" className="py-1 text-left font-normal text-ink-2">
              {r.name}
            </th>
            <td className="py-1 text-right tabular-nums text-ink">
              {r.value} {unit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ResultsBody({ r, note }: { r: AgentResults; note: string }) {
  const byAgent = topWithOthers(r.byAgent, 5);
  const minutes = [
    ...(r.minutesBefore !== null ? [{ name: 'Before (by hand)', minutes: r.minutesBefore }] : []),
    ...(r.minutesAfter !== null ? [{ name: 'After (with agent)', minutes: r.minutesAfter }] : []),
  ];
  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      <DashSection title="Filings by agent" meta={r.filings || undefined}>
        <DashBarChart
          data={byAgent}
          categoryKey="name"
          series={SERIES_FILINGS}
          layout="rows"
          categoryWidth={132}
          emptyLabel="No filings this month."
          valueFormatter={(v) => `${v ?? 0} filings`}
        />
        <ChartValues rows={byAgent.map((b) => ({ name: b.name, value: b.count }))} unit="filed" caption="Filings by agent" />
      </DashSection>
      <DashSection title="Time per filing" meta="minutes">
        <DashBarChart
          data={minutes}
          categoryKey="name"
          series={SERIES_MINUTES}
          layout="rows"
          categoryWidth={132}
          emptyLabel="No filings to time this month."
          valueFormatter={(v) => `${v ?? 0} min`}
        />
        <ChartValues rows={minutes.map((m) => ({ name: m.name, value: m.minutes }))} unit="min" caption="Minutes per filing" />
        <p className="mt-2 text-[12px] text-ink-muted">
          {note} After is the median of this month&apos;s runs, from start to finish, including time spent waiting for a person.
        </p>
      </DashSection>
      <DashSection title="Cost this month" flush>
        <CostLine
          label="Live browser"
          value={`${r.browserHours} h of ${r.browserHoursCap} h`}
          note={`${r.browserSessions} session${r.browserSessions === 1 ? '' : 's'} on SBC's server browser`}
        />
        <CostLine label="GSTZen API" value={`${r.apiFilings} filing${r.apiFilings === 1 ? '' : 's'}`} note="No price agreed yet, so the count is shown" />
      </DashSection>
      <DashSection title="Quality" flush>
        <CostLine label="Fields auto-filled" value={r.autoFilledPct === null ? '—' : `${r.autoFilledPct}%`} note={`${r.fieldsFilled} of ${r.fieldsTotal} fields · target ${r.autoFilledTarget}%`} />
        <CostLine label="Heals" value={String(r.heals)} note={r.healsFailed ? `${r.healsFailed} could not reach the field` : 'Every heal reached its field'} />
        <CostLine label="Recipe breaks" value={String(r.breaks)} note={`${r.breakRecipes} recipe${r.breakRecipes === 1 ? '' : 's'} · ${r.breaksFixed} fix${r.breaksFixed === 1 ? '' : 'es'} approved`} />
      </DashSection>
    </div>
  );
}

export default function AgentResultsPage({ path }: { path: string }) {
  const { user } = useApp();
  const firmAdmin = isFirmWideAdmin(user?.role);
  const now = useMemo(() => new Date(), []);
  const options = useMemo(() => monthOptions(now), [now]);
  const [month, setMonth] = useState(options[0]!.value);
  const query = useAgentResults(month, firmAdmin);
  const r = query.data?.results;
  const delta = r ? r.filings - r.filingsPrev : 0;

  return (
    <PageTransition>
      <SEO title="Agent results — VCFO Suite" description="What the card agents filed and the time they saved." path={path} />
      <div className="flex flex-col gap-5">
        <DashHero
          title="Agent results"
          subtitle={r ? `${r.label} · hours saved is an estimate` : undefined}
          stats={
            r
              ? [
                  { label: 'Filings', icon: FileCheck2, value: r.filings, of: delta ? `${delta > 0 ? '+' : '−'}${Math.abs(delta)} vs last month` : undefined },
                  {
                    label: 'Hours saved',
                    icon: Clock,
                    value: `${r.hoursSaved} h`,
                    note: r.savedPerFiling !== null ? `~${r.savedPerFiling} m per filing (estimate)` : 'Estimate',
                  },
                  { label: 'Auto-filled', icon: Wand2, value: r.autoFilledPct === null ? '—' : `${r.autoFilledPct}%`, note: `target ${r.autoFilledTarget}%` },
                  { label: 'Breaks', icon: Wrench, value: r.breaks, note: `${r.breaksFixed} fixed` },
                ]
              : []
          }
        >
          {firmAdmin ? (
            <span className="flex flex-wrap gap-2">
              <FilterSelect aria-label="Month" options={options} value={month} onChange={(e) => setMonth(e.target.value)} />
              <Button
                size="sm"
                variant="outline"
                disabled={!r || r.rows.length === 0}
                onClick={() => r && downloadCsv(`agent-results-${r.month}.csv`, agentResultsCsv(r))}
              >
                <Download aria-hidden />
                Export CSV
              </Button>
            </span>
          ) : null}
        </DashHero>
        {!firmAdmin ? (
          <EmptyState title="Only an admin can open Agent results." />
        ) : query.isPending ? (
          <SkeletonRows rows={6} />
        ) : query.isError || !r ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
            Could not load the results. Refresh the page.
          </p>
        ) : (
          <ResultsBody r={r} note={query.data.estimateNote} />
        )}
      </div>
    </PageTransition>
  );
}
