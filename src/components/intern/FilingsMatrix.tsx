'use client';

import { useMemo } from 'react';
import { DashSection } from '@/components/dash/DashSection';
import { EmptyState } from '@/components/ui/empty-state';
import { CompanyTile } from '@/components/staff/today/today-parts';
import type { ComplianceFiling } from '@/data/compliance';
import type { Engagement } from '@/data/engagements';
import { ymdInIst } from '@/lib/intern/intern-work';
import { cn } from '@/lib/utils';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MAX_FORMS = 9;

type Cell = { state: 'filed' | 'soon' | 'late' | 'upcoming'; day: number };

const CELL: Record<Cell['state'] | 'na', string> = {
  filed: 'bg-positive-soft text-positive',
  soon: 'bg-warning-soft text-warning',
  late: 'bg-danger-soft text-danger',
  upcoming: 'bg-surface-sunken text-ink-2',
  na: 'text-ink-faint',
};

/**
 * Clients × filings for this month (prototype `FilingsMatrix`): one row per client, one column
 * per form due this month (up to nine, the most common first). A cell shows ✓ when filed, ! when
 * late, else the due day; amber when due within seven days. A blank cell means that client has
 * no such filing this month. Built from the stored filings only.
 */
export function FilingsMatrix({ filings, engagements, now }: { filings: ComplianceFiling[]; engagements: Engagement[]; now: Date }) {
  const today = ymdInIst(now);
  const month = today.slice(0, 7);
  const { forms, rows } = useMemo(() => {
    const inMonth = filings.filter((f) => f.nextDue?.slice(0, 7) === month);
    const tally = new Map<string, number>();
    for (const f of inMonth) tally.set(f.filing, (tally.get(f.filing) ?? 0) + 1);
    const forms = [...tally.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_FORMS)
      .map(([form]) => form);
    const names = new Map(engagements.map((e) => [e.id, e.companyName]));
    const byClient = new Map<string, Map<string, Cell>>();
    const soonLimit = new Date(`${today}T00:00:00Z`).getTime() + 7 * 86_400_000;
    for (const f of inMonth) {
      if (!forms.includes(f.filing) || !names.has(f.engagementId)) continue;
      const due = f.nextDue.slice(0, 10);
      const dueT = new Date(`${due}T00:00:00Z`).getTime();
      const state: Cell['state'] =
        f.status === 'filed' ? 'filed' : f.status === 'overdue' || due < today ? 'late' : dueT <= soonLimit ? 'soon' : 'upcoming';
      const cells = byClient.get(f.engagementId) ?? new Map<string, Cell>();
      cells.set(f.filing, { state, day: Number(due.slice(8, 10)) });
      byClient.set(f.engagementId, cells);
    }
    const rows = [...byClient.entries()]
      .map(([id, cells]) => ({ id, name: names.get(id) ?? '', cells }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { forms, rows };
  }, [filings, engagements, month, today]);

  const legend = (
    <span className="hidden flex-wrap items-center gap-3 text-[12px] text-ink-muted md:flex">
      {(
        [
          ['filed', 'Filed'],
          ['soon', 'Due soon'],
          ['late', 'Overdue'],
          ['upcoming', 'Upcoming'],
        ] as const
      ).map(([k, label]) => (
        <span key={k} className="flex items-center gap-1.5">
          <i className={cn('h-2.5 w-2.5 rounded-[2px]', CELL[k])} aria-hidden />
          {label}
        </span>
      ))}
      <span>— Not applicable</span>
    </span>
  );

  return (
    <DashSection title={`Clients × filings · ${MONTHS[Number(month.slice(5, 7)) - 1]}`} meta={rows.length || undefined} right={legend}>
      {rows.length === 0 ? (
        <EmptyState title="No filings due this month" />
      ) : (
        <div className="max-w-full overflow-x-auto">
          <table className="border-collapse text-[12.5px]" style={{ minWidth: 200 + forms.length * 48 }}>
            <caption className="sr-only">Clients by filings due this month</caption>
            <thead>
              <tr>
                <th scope="col" className="h-9 border-b-1.5 border-line pr-3 text-left text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted">
                  Client
                </th>
                {forms.map((form) => (
                  <th key={form} scope="col" className="h-9 whitespace-nowrap border-b-1.5 border-line px-1 text-center font-mono text-[11px] font-medium text-ink-muted">
                    {form}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="h-10 border-b border-line-soft pr-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <CompanyTile name={r.name} />
                      <span className="max-w-[160px] truncate font-medium text-ink">{r.name}</span>
                    </span>
                  </td>
                  {forms.map((form) => {
                    const c = r.cells.get(form);
                    return (
                      <td key={form} className="border-b border-line-soft px-1 text-center">
                        <span
                          className={cn('mx-auto grid h-6 w-10 place-items-center rounded-sm font-medium tabular-nums', CELL[c?.state ?? 'na'])}
                          title={c ? `${form} · ${c.state === 'filed' ? 'filed' : c.state === 'late' ? 'overdue' : `due ${c.day}`}` : `${form} · not applicable`}
                        >
                          {!c ? '—' : c.state === 'filed' ? '✓' : c.state === 'late' ? '!' : c.day}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashSection>
  );
}
