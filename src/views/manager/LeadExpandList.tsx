'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/spectrum-chip';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadCell } from '@/components/metrics/people-cells';
import { LeadCompanyChip } from '@/components/intern/LeadCompanyChip';
import { todayStatusTone, dayMonth, TODAY_STATUS_ORDER } from '@/components/staff/today/today-rows';
import type { PersonMetrics } from '@/lib/metrics/practice-metrics';
import type { Engagement } from '@/data/engagements';
import { adminProjectPath } from '@/lib/projects/project-step-path';
import { cn } from '@/lib/utils';
import { PersonAvatar } from '@/views/admin/firm-people/parts';
import { ReassignDialog, canMoveItem } from '@/views/admin/work/ReassignDialog';
import type { TeamLead, TeamWorkItem } from '@/views/manager/team-work';

const ORDER = TODAY_STATUS_ORDER.map((s) => s.status);

/**
 * Project leads that expand (prototype `LeadExpandList`): each lead with open and late counts
 * and a load bar; a click opens their clients and open items, and each step or task can move to
 * another lead (Reassign, `/api/work/reassign`). Filings and requests move with the whole
 * client, which the Reassign dialog offers.
 */
export function LeadExpandList({
  leads,
  items,
  engagements,
  projectBase,
  peopleByInternId,
  allLeads,
  title = 'Project leads',
}: {
  /** The leads to list (those on the shown engagements). */
  leads: TeamLead[];
  items: TeamWorkItem[];
  engagements: Engagement[];
  projectBase: '/app/admin' | '/app/manager';
  peopleByInternId: Map<string, PersonMetrics>;
  /** Every lead the caller may move work to. */
  allLeads: TeamLead[];
  title?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [move, setMove] = useState<TeamWorkItem | null>(null);
  const maxOpen = Math.max(1, ...leads.map((l) => items.filter((i) => i.leadId === l.id && i.kind !== 'done').length));

  return (
    <DashSection title={title} meta={leads.length} flush>
      {leads.length === 0 ? (
        <EmptyState title="No project leads" className="m-4" />
      ) : (
        <>
          <div className="hidden h-9 grid-cols-[minmax(0,1fr)_64px_64px_140px_16px] items-center gap-3 border-b-1.5 border-line px-5 text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted md:grid">
            <span>Project lead</span>
            <span className="text-right">Open</span>
            <span className="text-right">Late</span>
            <span>Load</span>
            <span />
          </div>
          {leads.map((l) => {
            const openItems = items
              .filter((i) => i.leadId === l.id && i.kind !== 'done')
              .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'));
            const late = openItems.filter((i) => i.status === 'Overdue').length;
            const clients = engagements.filter((e) => e.internId === l.id || (e.leadIds ?? []).includes(l.id));
            const isOpen = open === l.id;
            return (
              <div key={l.id} className="border-t border-line-soft first:border-t-0">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : l.id)}
                  aria-expanded={isOpen}
                  className="grid w-full grid-cols-[minmax(0,1fr)_48px_16px] items-center gap-3 px-4 py-3 text-left text-[14px] hover:bg-surface-sunken md:grid-cols-[minmax(0,1fr)_64px_64px_140px_16px] md:px-5"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <PersonAvatar name={l.name} />
                    <span className="min-w-0">
                      <b className="block truncate font-medium text-ink">{l.name}</b>
                      <span className="block truncate text-[12.5px] text-ink-muted">
                        {clients.length ? clients.map((c) => c.companyName).join(', ') : 'No client yet'}
                      </span>
                    </span>
                  </span>
                  <span className="text-right font-medium tabular-nums">{openItems.length}</span>
                  <span className={cn('hidden text-right tabular-nums md:block', late ? 'font-medium text-danger' : 'text-ink-muted')}>{late}</span>
                  <span className="hidden h-2.5 gap-0.5 md:flex" aria-hidden>
                    {late > 0 ? <i className="block rounded-[2px] bg-danger-mid" style={{ width: `${(late / maxOpen) * 100}%` }} /> : null}
                    {openItems.length - late > 0 ? (
                      <i className="block rounded-[2px] bg-brand" style={{ width: `${((openItems.length - late) / maxOpen) * 100}%` }} />
                    ) : null}
                  </span>
                  <ChevronDown className={cn('h-4 w-4 text-ink-faint transition-transform', isOpen && 'rotate-180')} strokeWidth={1.6} aria-hidden />
                </button>
                {isOpen ? (
                  <div className="border-t border-line-soft bg-surface-sunken">
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 md:px-5">
                      <span className="text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted">Clients</span>
                      {clients.map((c) => (
                        <Link
                          key={c.id}
                          href={adminProjectPath(c, projectBase)}
                          className="inline-flex h-6 items-center gap-1.5 rounded-md border-1.5 border-line bg-surface-raised px-2 text-[12px] font-medium text-ink-2 hover:bg-surface-sunken"
                        >
                          {c.companyName}
                        </Link>
                      ))}
                      <span className="ml-auto flex items-center gap-2 text-[12px] text-ink-muted">
                        <Link href={`${projectBase}/team/${encodeURIComponent(l.id)}`} className="font-medium text-brand-text hover:underline">
                          Open {l.name.split(/\s+/)[0]}
                        </Link>
                        <LoadCell person={peopleByInternId.get(l.id)} />
                      </span>
                    </div>
                    {openItems.length === 0 ? (
                      <EmptyState title="Nothing open" className="mx-4 mb-3 min-h-[64px] py-3 md:mx-5" />
                    ) : (
                      openItems.map((t) => (
                        <div key={t.id} className="flex flex-wrap items-center gap-3 border-t border-line-soft px-4 py-2.5 text-[13.5px] md:flex-nowrap md:px-5">
                          <LeadCompanyChip name={t.companyName} compact />
                          <Link href={t.href} className="min-w-0 flex-1 hover:underline">
                            <span className="block truncate font-medium text-ink">{t.title}</span>
                            <span className="block truncate text-[12.5px] text-ink-muted">
                              {t.companyName}
                              {t.catalogLabel ? ` · ${t.catalogLabel}` : ''}
                            </span>
                          </Link>
                          <Chip tone={todayStatusTone(t.status)} fixed>
                            {t.status}
                          </Chip>
                          <span className={cn('w-[56px] text-right text-[12.5px] tabular-nums', t.status === 'Overdue' ? 'font-medium text-danger' : 'text-ink-muted')}>
                            {dayMonth(t.dueAt) || '—'}
                          </span>
                          <Button size="sm" variant="outline" onClick={() => setMove(t)} disabled={!canMoveItem(t.row) && !t.engagementId}>
                            Reassign
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </>
      )}
      <ReassignDialog row={move?.row ?? null} onOpenChange={(o) => !o && setMove(null)} leads={allLeads} />
    </DashSection>
  );
}
