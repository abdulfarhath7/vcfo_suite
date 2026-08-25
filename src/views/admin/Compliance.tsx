"use client";

import { useState, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { m } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { PageBackCluster } from '@/components/shell/PageBackButton';
import { AccentKpi } from '@/components/admin/AccentKpi';
import { SEO } from '@/components/SEO';
import { ComplianceFiling } from '@/data/compliance';
import { ComplianceCalendar } from '@/components/admin/ComplianceCalendar';
import { StatutoryCalendar } from '@/components/admin/StatutoryCalendar';
import { isFilingInMonth } from '@/components/admin/compliance-calendar-utils';
import { useComplianceFilings } from '@/hooks/use-compliance-filings';
import { Calendar, CalendarCheck, CalendarCheck2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { IconChip, toneForKey, TONE_BADGE } from '@/components/common/IconChip';
import { cn } from '@/lib/utils';

const statusMap: Record<ComplianceFiling['status'], { label: string; cls: string }> = {
  'upcoming':    { label: 'Due soon',    cls: 'bg-info-light text-info-text' },
  'in-progress': { label: 'In preparation', cls: 'bg-warning-light text-warning-text' },
  'filed':       { label: 'Filed',       cls: 'bg-success-light text-success-text' },
  'overdue':     { label: 'Past due',     cls: 'bg-danger-light text-danger-text' },
};

const riskMap = {
  low:    'text-text-tertiary',
  medium: 'text-warning-text',
  high:   'text-danger-text',
};

export default function Compliance({
  initialView = 'statutory',
}: {
  initialView?: 'statutory' | 'tracker';
}) {
  const { user, engagements, teamMembers, getStateForEngagement } = useApp();
  const pathname = usePathname();
  const isInternView = user?.role === 'intern' || pathname.startsWith('/app/intern/');
  const allFilings = useComplianceFilings(engagements, getStateForEngagement);
  const [tab, setTab] = useState<'statutory' | 'tracker'>(initialView);
  const active = isInternView ? initialView : tab;
  const [filter, setFilter] = useState<'all' | ComplianceFiling['status']>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const filteredFilings = useMemo(() => {
    return allFilings.filter(
      (c) =>
        (filter === 'all' || c.status === filter) &&
        (clientFilter === 'all' || c.engagementId === clientFilter),
    );
  }, [allFilings, filter, clientFilter]);

  const rows = useMemo(() => {
    return filteredFilings
      .filter((c) => isFilingInMonth(c.nextDue, viewMonth))
      .sort((a, b) => new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime());
  }, [filteredFilings, viewMonth]);

  const overdue = allFilings.filter((c) => c.status === 'overdue').length;
  const inProgress = allFilings.filter((c) => c.status === 'in-progress').length;
  const upcoming = allFilings.filter((c) => c.status === 'upcoming').length;

  return (
    <PageTransition>
      <SEO
        title={
          isInternView && active === 'tracker'
            ? 'Filing tracker — VCFO Suite'
            : 'Compliance calendar — VCFO Suite'
        }
        description="Recurring statutory filings — GST, TDS, ROC, PF, RBI — across your GCC portfolio."
        path={
          isInternView
            ? active === 'tracker'
              ? '/app/intern/compliance/tracker'
              : '/app/intern/compliance'
            : '/app/manager/compliance'
        }
      />

      {isInternView ? null : (
        <>
          <PageHeader accent="emerald" icon={CalendarCheck2} title="Compliance calendar" />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <AccentKpi tone="violet" icon={Calendar}      label="Active filings"  value={allFilings.length} />
            <AccentKpi tone="sky"     icon={Clock}         label="Due in 30 days"       value={upcoming} />
            <AccentKpi tone="amber"   icon={CheckCircle2}  label="In preparation"    value={inProgress} />
            <AccentKpi tone="emerald" icon={AlertTriangle} label="Past due"        value={overdue} />
          </div>
        </>
      )}

      {/* Manager/admin keep the two views as tabs. Intern: statutory is the page; tracker is /compliance/tracker. */}
      {!isInternView && (
        <div className="mb-4 inline-flex rounded-lg border border-border bg-panel p-0.5">
          {(
            [
              { id: 'statutory', label: 'Statutory calendar' },
              { id: 'tracker', label: 'Client filing tracker' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'h-8 rounded-md px-3.5 text-[12.5px] font-medium transition-colors',
                tab === t.id
                  ? 'bg-role-soft text-role-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {active === 'statutory' && (
        <StatutoryCalendar
          engagements={engagements}
          trackerHref={isInternView ? '/app/intern/compliance/tracker' : undefined}
          showBack={isInternView}
        />
      )}

      <div className={cn('surface overflow-hidden', active !== 'tracker' && 'hidden')}>
        <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap">
          {isInternView ? (
            active === 'tracker' ? (
              <PageBackCluster className="mr-2">
                <h1 className="text-[13px] font-semibold text-ink">Filing tracker</h1>
              </PageBackCluster>
            ) : (
              <div className="mr-2 text-[13px] font-semibold text-ink">Filing tracker</div>
            )
          ) : (
            <h2 className="mr-2 text-[13px] font-semibold text-ink">All compliances</h2>
          )}
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="h-7 px-2 rounded-md border border-border bg-surface text-[11.5px] text-ink"
          >
            <option value="all">All companies</option>
            {engagements.map((e) => <option key={e.id} value={e.id}>{e.companyName}</option>)}
          </select>
          <div className="flex items-center gap-1 ml-auto">
            {(['all', 'upcoming', 'in-progress', 'overdue', 'filed'] as const).map((s) => (
              <button type="button"
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  'h-7 px-2.5 rounded-md text-[11.5px] font-medium transition-colors',
                  filter === s ? 'gold-sheen' : 'text-text-tertiary hover:bg-muted',
                )}
              >
                {s === 'all' ? 'All' : statusMap[s].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(280px,320px)_1fr]">
          <ComplianceCalendar
            filings={filteredFilings}
            month={viewMonth}
            onMonthChange={setViewMonth}
          />
          <div className="min-w-0">
            <div className="grid grid-cols-[1.4fr_1fr_1.4fr_1fr_1fr_120px_80px] gap-3 px-4 h-10 items-center bg-table-header text-[11px] uppercase tracking-wider text-text-tertiary border-b border-border">
              <div>Filing</div>
              <div>Authority</div>
              <div>GCC project</div>
              <div>Delivery owner</div>
              <div>Next due</div>
              <div>Status</div>
              <div>Risk</div>
            </div>

            <div className="divide-y divide-border">
              {rows.map((c, i) => {
                const eng = engagements.find((e) => e.id === c.engagementId);
                const owner = teamMembers.find((t) => t.id === c.ownerId);
                const st = statusMap[c.status];
                return (
                  <m.div
                    key={c.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.025 * i }}
                    className="grid grid-cols-[1.4fr_1fr_1.4fr_1fr_1fr_120px_80px] gap-3 px-4 py-3 items-center hover:bg-muted/40"
                  >
                    <div>
                      <div className="text-[13px] font-medium text-ink">{c.filing}</div>
                      <div className="text-[11px] text-text-tertiary capitalize">
                        {c.frequency}
                        {c.fyLabel ? ` · ${c.fyLabel}` : ''}
                      </div>
                    </div>
                    <div>
                      <span
                        className={cn(
                          'inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          TONE_BADGE[toneForKey(c.authority)],
                        )}
                      >
                        {c.authority}
                      </span>
                    </div>
                    <div className="text-[12.5px] text-ink-soft truncate">{eng?.companyName}</div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-full gold-sheen text-[10px] font-semibold flex items-center justify-center shrink-0">{owner?.initials}</span>
                      <span className="text-[12px] text-ink-soft truncate">{owner?.name}</span>
                    </div>
                    <div className="text-[12.5px] text-ink tabular-nums">{new Date(c.nextDue).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <span className={cn('inline-flex px-2 h-5 items-center rounded-full text-[10.5px] font-medium w-fit', st.cls)}>{st.label}</span>
                    <span className={cn('text-[11.5px] font-medium capitalize', riskMap[c.penaltyRisk])}>{c.penaltyRisk}</span>
                  </m.div>
                );
              })}
              {rows.length === 0 && (
                <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                  <IconChip icon={CalendarCheck} tone="success" size="lg" />
                  <p className="text-[13px] text-muted-foreground">
                    No filings due in{' '}
                    {viewMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} for the current filters.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
