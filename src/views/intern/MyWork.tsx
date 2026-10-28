'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { InternWorkBoardCard, InternWorkKindChip } from '@/components/intern/InternWorkRow';
import { InternWorkCtaButton } from '@/components/intern/InternWorkCtaButton';
import { InternWorkDrawer } from '@/components/intern/InternWorkDrawer';
import { LeadCompanyChip } from '@/components/intern/LeadCompanyChip';
import { WorkFilterChip } from '@/components/intern/WorkFilterChip';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { Tag } from '@/components/ui/spectrum-chip';
import { Button } from '@/components/ui/button';
import { useInternPortfolio } from '@/hooks/use-intern-portfolio';
import {
  INTERN_WORK_VIEW_KEY,
  filterInternWork,
  formatDueLabel,
  formatIstWeekdayDay,
  internTimelineGantt,
  internWorkBoard,
  internWorkPath,
  parseInternWorkDay,
  parseInternWorkFocus,
  parseInternWorkKindFilter,
  parseInternWorkTag,
  parseInternWorkView,
  sortInternWork,
  ymdInIst,
  type InternWorkFocus,
  type InternWorkItem,
  type InternWorkKindFilter,
  type InternWorkTag,
  type InternWorkView,
} from '@/lib/intern/intern-work';
import { cn } from '@/lib/utils';

const VIEWS: { key: InternWorkView; label: string }[] = [
  { key: 'list', label: 'List' },
  { key: 'board', label: 'Board' },
  { key: 'tl', label: 'Timeline' },
];

const FOCUS_OPTIONS: { value: InternWorkFocus; label: string }[] = [
  { value: 'action', label: 'Needs action' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'due', label: 'Due this week' },
  { value: 'progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

const TAG_LABEL: Record<InternWorkTag, string> = {
  rejected: 'Sent back',
  review: 'Review',
  deliver: 'Deliver',
  critical: 'Critical',
  overdue: 'Overdue',
  client: 'With client',
  manager: 'With manager',
  filings: 'Filings',
  steps: 'Steps',
};

/**
 * Lead Work (prototype `WorkScreen`): list, board and timeline of the lead's open steps and
 * filings. The views sit in a segmented switch; the filters are R-10 chips in the table head
 * bar and still live in the URL, so links from Today keep working. A row opens the task drawer
 * with the item's facts and its action; the step page stays one click away.
 */
function InternMyWorkInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { workItems, kpis, myEngagements } = useInternPortfolio();
  const now = useMemo(() => new Date(), []);
  const focus = parseInternWorkFocus(params.get('focus'));
  const tag = parseInternWorkTag(params.get('tag'));
  const companyId = params.get('company');
  const kind = parseInternWorkKindFilter(params.get('kind'));
  const day = parseInternWorkDay(params.get('day'));
  const [view, setView] = useState<InternWorkView>(() => parseInternWorkView(params.get('view')));
  const [kb, setKb] = useState(-1);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = params.get('view');
    if (fromUrl) {
      setView(parseInternWorkView(fromUrl));
      return;
    }
    try {
      const stored = window.localStorage.getItem(INTERN_WORK_VIEW_KEY);
      if (stored) setView(parseInternWorkView(stored));
    } catch {
      /* ignore */
    }
  }, [params]);

  const filtered = useMemo(
    () =>
      sortInternWork(
        filterInternWork(workItems, { focus, tag, companyId, kind, day }, now),
      ),
    [workItems, focus, tag, companyId, kind, day, now],
  );
  const openItem = openId ? workItems.find((item) => item.id === openId) ?? null : null;

  const companies = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of myEngagements) seen.set(e.id, e.companyName);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }));
  }, [myEngagements]);

  const go = (next: {
    focus?: InternWorkFocus;
    tag?: InternWorkTag | null;
    companyId?: string | null;
    kind?: InternWorkKindFilter;
    view?: InternWorkView;
    day?: string | null;
  }) => {
    const href = internWorkPath({
      focus: next.focus ?? focus,
      tag: next.tag === undefined ? tag : next.tag,
      companyId: next.companyId === undefined ? companyId : next.companyId,
      kind: next.kind ?? kind,
      view: next.view ?? view,
      day: next.day === undefined ? day : next.day,
    });
    router.replace(href, { scroll: false });
  };

  const chooseView = (next: InternWorkView) => {
    setView(next);
    try {
      window.localStorage.setItem(INTERN_WORK_VIEW_KEY, next);
    } catch {
      /* ignore */
    }
    go({ view: next });
  };

  useEffect(() => {
    if (view !== 'list' || openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'j' || e.key === 'J') setKb((i) => Math.min(i + 1, filtered.length - 1));
      else if (e.key === 'k' || e.key === 'K') setKb((i) => Math.max(i - 1, 0));
      else if (e.key === 'Enter' && kb >= 0 && filtered[kb]) {
        // Without this the Enter press lands on the drawer's close button and shuts it at once.
        e.preventDefault();
        setOpenId(filtered[kb]!.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, filtered, kb, openId]);

  const anyFilter = Boolean(companyId || kind !== 'all' || focus !== 'all' || tag || day);
  const filters = (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <WorkFilterChip
        label="Company"
        value={companyId ?? ''}
        options={companies.map(([id, name]) => ({ value: id, label: name }))}
        onChange={(v) => go({ companyId: v || null })}
      />
      <WorkFilterChip
        label="Status"
        value={focus === 'all' ? '' : focus}
        options={FOCUS_OPTIONS}
        onChange={(v) => go({ focus: (v || 'all') as InternWorkFocus })}
      />
      <WorkFilterChip
        label="Show"
        value={kind === 'all' ? '' : kind}
        options={[
          { value: 'steps', label: 'Steps only' },
          { value: 'filings', label: 'Filings only' },
        ]}
        onChange={(v) => go({ kind: (v || 'all') as InternWorkKindFilter })}
      />
      {tag ? <WorkFilterChip label="Tag" value={tag} valueLabel={TAG_LABEL[tag]} options={[]} onChange={() => go({ tag: null })} /> : null}
      {day ? (
        <WorkFilterChip label="Day" value={day} valueLabel={formatIstWeekdayDay(day).label} options={[]} onChange={() => go({ day: null })} />
      ) : null}
      {anyFilter ? (
        <Button
          variant="link"
          size="sm"
          onClick={() => router.replace(internWorkPath({ focus: 'all', tag: null, companyId: null, kind: 'all', view, day: null }), { scroll: false })}
        >
          Clear
        </Button>
      ) : null}
    </div>
  );

  return (
    <PageTransition>
      <SEO title="My work — VCFO Suite" description="List, board, and timeline of your open steps and filings." path="/app/intern/tasks" />

      <div className="mb-5 flex min-w-0 flex-wrap items-center gap-3">
        <div className="min-w-0 flex-[1_1_240px]">
          <h1 className="text-[28px] font-medium leading-9 tracking-[-0.01em] text-ink">Work</h1>
          <p className="text-[13.5px] text-ink-muted tabular-nums">
            {kpis.openCount} open · {kpis.companyCount} {kpis.companyCount === 1 ? 'company' : 'companies'}
          </p>
        </div>
        <SpectrumTabs
          size="md"
          label="Work view"
          items={VIEWS}
          value={view}
          onChange={(next) => chooseView(next as InternWorkView)}
        />
      </div>

      {view === 'list' ? (
        <WorkCard filters={filters} meta={`${filtered.filter((i) => i.kind !== 'done').length} open`}>
          <ListView items={filtered} kb={kb} now={now} onOpen={(item) => setOpenId(item.id)} />
        </WorkCard>
      ) : null}
      {view === 'board' ? (
        <>
          <div className="mb-3 flex min-h-[44px] flex-wrap items-center gap-2">{filters}</div>
          <BoardView items={filtered} now={now} onOpen={(item) => setOpenId(item.id)} />
        </>
      ) : null}
      {view === 'tl' ? (
        <TimelineView items={filtered} now={now} selectedDay={day} filters={filters} onOpen={(item) => setOpenId(item.id)} />
      ) : null}

      <InternWorkDrawer item={openItem} now={now} onClose={() => setOpenId(null)} />
    </PageTransition>
  );
}

/** A card whose head bar holds the filter chips (R-08, R-10) and a small count. */
function WorkCard({
  filters,
  meta,
  right,
  children,
}: {
  filters: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="surface min-w-0 overflow-hidden">
      <div className="flex min-h-[52px] min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-soft px-4 py-2">
        {filters}
        {right}
        {meta ? <span className="shrink-0 text-[12.5px] text-ink-muted tabular-nums">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

const LIST_COLS = 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_112px_76px_minmax(0,auto)]';
const HEAD = 'px-2.5 text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted';

/** List view: T1 clean rows (R-07). J and K move the cursor; Enter opens the drawer. */
function ListView({
  items,
  kb,
  now,
  onOpen,
}: {
  items: InternWorkItem[];
  kb: number;
  now: Date;
  onOpen: (item: InternWorkItem) => void;
}) {
  if (items.length === 0) return <EmptyWork className="m-4" />;
  return (
    <div role="table" aria-label="Work">
      <div role="row" className={cn('hidden h-9 items-center border-b-1.5 border-line px-1.5 md:grid', LIST_COLS)}>
        <div role="columnheader" className={HEAD}>Step or filing</div>
        <div role="columnheader" className={HEAD}>Company</div>
        <div role="columnheader" className={HEAD}>Status</div>
        <div role="columnheader" className={HEAD}>Due</div>
        <div role="columnheader" className={HEAD}>
          <span className="sr-only">Action</span>
        </div>
      </div>
      {items.map((item, i) => {
        const late = item.isOverdue && item.kind !== 'done';
        return (
          <div
            key={item.id}
            role="row"
            aria-selected={kb === i ? true : undefined}
            className={cn(
              'grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-y-1 border-b border-line-soft px-1.5 py-1.5 text-[14px] last:border-b-0 hover:bg-surface-sunken/60 md:py-0',
              LIST_COLS,
              kb === i && 'bg-surface-sunken',
            )}
          >
            <div role="cell" className="min-w-0 px-2.5">
              <button
                type="button"
                onClick={() => onOpen(item)}
                title={item.title}
                className={cn(
                  'block max-w-full truncate text-left font-medium text-ink hover:underline',
                  item.kind === 'done' && 'text-ink-muted line-through',
                )}
              >
                {item.title}
              </button>
              <span className="block truncate text-[12px] text-ink-muted md:hidden">
                {item.companyName} · <span className={cn('tabular-nums', late && 'font-medium text-danger')}>{formatDueLabel(item.dueAt, now)}</span>
              </span>
            </div>
            <div role="cell" className="hidden min-w-0 px-2.5 text-ink-2 md:block">
              <LeadCompanyChip name={item.companyName} engagementId={item.engagementId} />
            </div>
            <div role="cell" className="px-2.5 md:block">
              <InternWorkKindChip item={item} />
            </div>
            <div role="cell" className={cn('hidden px-2.5 tabular-nums text-ink-2 md:block', late && 'font-medium text-danger')}>
              {formatDueLabel(item.dueAt, now)}
            </div>
            <div role="cell" className="col-span-2 px-2.5 md:col-span-1 md:justify-self-end">
              <InternWorkCtaButton item={item} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const BOARD_COLS: { key: 'action' | 'progress' | 'waiting' | 'done'; label: string; tone: 'warn' | 'prog' | 'teal' | 'ok' }[] = [
  { key: 'action', label: 'Needs action', tone: 'warn' },
  { key: 'progress', label: 'In progress', tone: 'prog' },
  { key: 'waiting', label: 'Waiting', tone: 'teal' },
  { key: 'done', label: 'Done this week', tone: 'ok' },
];

/** Board view (prototype `WorkBoard`): four quiet columns with a count tag in each head. */
function BoardView({ items, now, onOpen }: { items: InternWorkItem[]; now: Date; onOpen: (item: InternWorkItem) => void }) {
  const cols = internWorkBoard(items, now);
  return (
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
      {BOARD_COLS.map((col) => (
        <section
          key={col.key}
          data-col={col.key}
          aria-label={col.label}
          className="min-w-0 rounded-md border-1.5 border-line bg-surface-sunken"
        >
          <header className="flex h-11 items-center gap-2 border-b border-line-soft px-4">
            <h2 className="text-[14px] font-medium text-ink">{col.label}</h2>
            <Tag tone={col.tone}>{cols[col.key].length}</Tag>
          </header>
          <div className="grid gap-2 p-3">
            {cols[col.key].length === 0 ? <EmptyWork className="min-h-[72px] py-4" /> : null}
            {cols[col.key].map((item) => (
              <InternWorkBoardCard key={item.id} item={item} now={now} dim={col.key === 'done'} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const BAR_TONE = {
  overdue: 'bg-danger-mid text-white',
  soon: 'border-1.5 border-warning-mid bg-warning-soft text-warning',
  ok: 'hatch text-brand-text',
  done: 'bg-positive-mid text-white',
} as const;

const TIMELINE_LEGEND: Array<[string, string]> = [
  ['On track', 'hatch'],
  ['Due soon', 'border-1.5 border-warning-mid bg-warning-soft'],
  ['Overdue', 'bg-danger-mid'],
  ['Done', 'bg-positive-mid'],
];

/**
 * Timeline view (R-21): a 14-day Gantt with 16px bars, 3px corners and the orange today line.
 * An on-track bar shows the part up to today solid and the rest as blurple hatch.
 */
function TimelineView({
  items,
  now,
  selectedDay,
  filters,
  onOpen,
}: {
  items: InternWorkItem[];
  now: Date;
  selectedDay: string | null;
  filters: ReactNode;
  onOpen: (item: InternWorkItem) => void;
}) {
  const today = ymdInIst(now);
  const gantt = internTimelineGantt(items, now);
  const todayIdx = gantt.window.indexOf(today);
  const groups: { id: string; name: string; rows: typeof gantt.rows }[] = [];
  for (const row of gantt.rows) {
    let g = groups.find((x) => x.id === row.item.engagementId);
    if (!g) {
      g = { id: row.item.engagementId, name: row.item.companyName, rows: [] };
      groups.push(g);
    }
    g.rows.push(row);
  }
  const grid = { gridTemplateColumns: `minmax(150px,220px) repeat(${gantt.window.length}, minmax(30px, 1fr))` };
  const legend = (
    <span className="hidden flex-wrap items-center gap-3 text-[12px] text-ink-muted xl:flex">
      {TIMELINE_LEGEND.map(([label, cls]) => (
        <span key={label} className="flex items-center gap-1.5">
          <i className={cn('h-2.5 w-3.5 rounded-bar', cls)} aria-hidden />
          {label}
        </span>
      ))}
    </span>
  );
  const first = gantt.window[0];
  const last = gantt.window[gantt.window.length - 1];

  return (
    <div className="flex flex-col gap-4">
      <WorkCard
        filters={filters}
        right={legend}
        meta={first && last ? `${formatDueLabel(`${first}T12:00:00+05:30`, now)} to ${formatDueLabel(`${last}T12:00:00+05:30`, now)}` : undefined}
      >
        {gantt.rows.length === 0 && gantt.later.length === 0 ? (
          <EmptyWork className="m-4" />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div className="grid h-9 items-center border-b-1.5 border-line text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted" style={grid}>
                <span className="px-4">Task</span>
                {gantt.window.map((ymd) => {
                  const heading = formatIstWeekdayDay(ymd);
                  const isToday = ymd === today;
                  const weekend = heading.weekday === 'Sat' || heading.weekday === 'Sun';
                  return (
                    <span
                      key={ymd}
                      id={selectedDay === ymd ? 'intern-tl-day' : undefined}
                      className={cn(
                        'text-center tracking-normal tabular-nums',
                        isToday && 'text-brand-text',
                        weekend && !isToday && 'text-ink-faint',
                        selectedDay === ymd && 'rounded-mark bg-brand-soft text-brand-text',
                      )}
                    >
                      {heading.weekday.charAt(0)} {heading.day}
                    </span>
                  );
                })}
              </div>
              {groups.map((group) => (
                <div key={group.id}>
                  <p className="flex items-center gap-2 border-b border-line-soft px-4 py-1.5 text-[12px] font-medium text-ink-muted">
                    <LeadCompanyChip name={group.name} compact />
                    <span className="truncate">{group.name}</span>
                  </p>
                  {group.rows.map((row) => {
                    const span = Math.max(1, row.endIdx - row.startIdx + 1);
                    const doneShare =
                      row.priority === 'ok' && todayIdx >= row.startIdx
                        ? Math.max(0, Math.min(1, (todayIdx + 1 - row.startIdx) / span))
                        : 0;
                    return (
                      <div key={row.item.id} className="relative grid border-b border-line-soft py-2 last:border-b-0" style={grid}>
                        <button
                          type="button"
                          onClick={() => onOpen(row.item)}
                          title={row.item.title}
                          className="min-w-0 truncate px-4 text-left text-[13px] font-medium text-ink hover:underline"
                          style={{ gridColumn: 1, gridRow: 1 }}
                        >
                          {row.item.title}
                        </button>
                        {todayIdx >= 0 ? (
                          <span
                            aria-hidden
                            className="pointer-events-none -my-2 flex justify-center"
                            style={{ gridColumn: `${todayIdx + 2} / span 1`, gridRow: 1 }}
                          >
                            <i className="block h-full w-0.5 bg-highlight-bright" />
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onOpen(row.item)}
                          title={`${row.item.title} · ${row.item.why}`}
                          className={cn(
                            'relative z-[1] flex h-4 min-w-0 items-center self-center overflow-hidden whitespace-nowrap rounded-bar px-1.5 text-[11px] font-medium hover:opacity-90',
                            BAR_TONE[row.priority],
                          )}
                          style={{ gridColumn: `${row.startIdx + 2} / ${row.endIdx + 3}`, gridRow: 1 }}
                        >
                          {doneShare > 0 ? (
                            <i className="absolute inset-y-0 left-0 bg-brand" style={{ width: `${doneShare * 100}%` }} aria-hidden />
                          ) : null}
                          <span className={cn('relative truncate', doneShare > 0.5 && 'text-on-brand')}>{row.item.why}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </WorkCard>
      {gantt.later.length > 0 ? (
        <section className="surface min-w-0 overflow-hidden">
          <div className="flex min-h-[52px] items-center gap-2.5 border-b border-line-soft px-4">
            <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">Later</h2>
            <span className="text-[12.5px] text-ink-muted tabular-nums">{gantt.later.length}</span>
          </div>
          <ListView items={gantt.later} kb={-1} now={now} onOpen={onOpen} />
        </section>
      ) : null}
    </div>
  );
}

function EmptyWork({ className }: { className?: string }) {
  return <EmptyState title="Nothing in this view" className={className} />;
}

export default function InternMyWork() {
  return (
    <Suspense fallback={<div className="text-[15px] text-ink-muted">Work</div>}>
      <InternMyWorkInner />
    </Suspense>
  );
}
