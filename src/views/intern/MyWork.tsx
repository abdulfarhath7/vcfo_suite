'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, Columns3, List } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageBackButton } from '@/components/shell/PageBackButton';
import { SEO } from '@/components/SEO';
import { InternWorkBoardCard, InternWorkDenseRow } from '@/components/intern/InternWorkRow';
import { InternWorkCtaButton } from '@/components/intern/InternWorkCtaButton';
import { LeadCompanyChip, LeadCompanyPill } from '@/components/intern/LeadCompanyChip';
import { internKindChipLabel, internToneBadge, internToneBg, internToneText, KIND_TONE } from '@/components/intern/intern-tones';
import { useInternPortfolio } from '@/lib/use-intern-portfolio';
import {
  INTERN_WORK_VIEW_KEY,
  TIMELINE_PRIORITY_TONE,
  WEEK_CHIP_TONE,
  filterInternWork,
  formatDueLabel,
  formatIstWeekdayDay,
  internTimelineGantt,
  internWeekMarkKind,
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
} from '@/lib/intern-work';
import { cn } from '@/lib/utils';

const VIEW_BTN: { id: InternWorkView; label: string; icon: typeof List }[] = [
  { id: 'list', label: 'List', icon: List },
  { id: 'board', label: 'Board', icon: Columns3 },
  { id: 'tl', label: 'Timeline', icon: CalendarClock },
];

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
    if (view !== 'list') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'j' || e.key === 'J') setKb((i) => Math.min(i + 1, filtered.length - 1));
      else if (e.key === 'k' || e.key === 'K') setKb((i) => Math.max(i - 1, 0));
      else if (e.key === 'Enter' && kb >= 0 && filtered[kb]) {
        router.push(filtered[kb]!.href);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, filtered, kb, router]);

  return (
    <PageTransition>
      <SEO title="My work — VCFO Suite" description="List, board, and timeline of your open steps and filings." path="/app/intern/tasks" />

      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <PageBackButton className="-ml-1.5" />
          <h1 className="serif min-w-0 text-[26px] font-semibold tracking-tight text-ink">My work</h1>
        </div>
        <span className="text-xs font-bold text-text-tertiary">
          {kpis.openCount} open · {kpis.companyCount} {kpis.companyCount === 1 ? 'company' : 'companies'}
        </span>
        <div className="ml-auto flex shrink-0 overflow-hidden rounded-md border border-border bg-panel shadow-layered" role="tablist">
          {VIEW_BTN.map((btn) => {
            const Icon = btn.icon;
            const on = view === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => chooseView(btn.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-extrabold text-muted-foreground',
                  on && 'bg-primary text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <FilterChip on={!companyId} label="All companies" onClick={() => go({ companyId: null })} />
        {companies.map(([id, name]) => (
          <FilterChip key={id} on={companyId === id} label={name.split(/\s+/)[0] ?? name} onClick={() => go({ companyId: id })} />
        ))}
        <span className="w-2" />
        <FilterChip on={kind === 'all'} label="Steps + filings" onClick={() => go({ kind: 'all' })} />
        <FilterChip on={kind === 'steps'} label="Steps only" onClick={() => go({ kind: 'steps' })} />
        <FilterChip on={kind === 'filings'} label="Filings only" onClick={() => go({ kind: 'filings' })} />
        {day ? (
          <FilterChip on label={`${formatIstWeekdayDay(day).label} · IST`} onClick={() => go({ day: null })} />
        ) : null}
      </div>

      {view === 'list' ? <ListView items={filtered} kb={kb} now={now} /> : null}
      {view === 'board' ? <BoardView items={filtered} now={now} /> : null}
      {view === 'tl' ? <TimelineView items={filtered} now={now} selectedDay={day} /> : null}
    </PageTransition>
  );
}

function FilterChip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border border-border bg-panel px-3.5 py-1.5 text-xs font-extrabold text-muted-foreground hover:border-border',
        on && 'border-transparent bg-primary-light text-primary-dark',
      )}
    >
      {label}
    </button>
  );
}

const LIST_COLS =
  'grid-cols-[minmax(0,1.5fr)_minmax(0,0.95fr)_minmax(0,1.05fr)_minmax(4.25rem,0.55fr)_auto]';

function ListView({ items, kb, now }: { items: InternWorkItem[]; kb: number; now: Date }) {
  if (items.length === 0) {
    return <EmptyWork />;
  }
  return (
    <>
      <div className="surface overflow-hidden">
        <div className={cn('hidden xl:grid text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-text-tertiary', LIST_COLS)}>
          <div className="px-3.5 py-2.5">Step / filing</div>
          <div className="min-w-0 px-3.5 py-2.5">Company</div>
          <div className="min-w-0 px-3.5 py-2.5">State</div>
          <div className="px-3.5 py-2.5">Due</div>
          <div className="px-3.5 py-2.5" />
        </div>
        {items.map((item, i) => (
          <div
            key={item.id}
            className={cn(
              'border-t border-border text-[13px] font-semibold hover:bg-raised/70',
              kb === i && 'bg-raised',
              item.kind === 'done' && 'opacity-70',
            )}
          >
            <div className="px-3.5 py-3 xl:hidden">
              <InternWorkDenseRow item={item} showCompany />
              <p className={cn('mt-1.5 font-mono text-[11.5px] font-semibold', item.isOverdue && internToneText('danger'))}>
                Due {formatDueLabel(item.dueAt, now)}
              </p>
            </div>
            <div className={cn('hidden items-center xl:grid', LIST_COLS)}>
              <Link
                href={item.href}
                title={item.title}
                className={cn(
                  'min-w-0 truncate px-3.5 py-3 hover:underline',
                  item.kind === 'done' && 'text-text-tertiary line-through',
                )}
              >
                {item.title}
              </Link>
              <div className="min-w-0 overflow-hidden px-3.5 py-3">
                <LeadCompanyChip name={item.companyName} engagementId={item.engagementId} />
              </div>
              <div className="min-w-0 overflow-hidden px-3.5 py-3">
                <span
                  title={item.why}
                  className={cn(
                    'inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-[11px] font-extrabold',
                    internToneBadge(KIND_TONE[item.kind] ?? 'info'),
                  )}
                >
                  {item.why}
                </span>
              </div>
              <div className={cn('px-3.5 py-3 font-mono text-[11.5px]', item.isOverdue && internToneText('danger'))}>
                {formatDueLabel(item.dueAt, now)}
              </div>
              <div className="px-3.5 py-3">
                <InternWorkCtaButton item={item} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function BoardView({ items, now }: { items: InternWorkItem[]; now: Date }) {
  const cols = internWorkBoard(items, now);
  const meta: { key: keyof typeof cols; label: string; tone: string }[] = [
    { key: 'action', label: 'Needs action', tone: 'bg-primary text-white' },
    { key: 'progress', label: 'In progress', tone: 'bg-accent-violet text-white' },
    { key: 'waiting', label: 'Waiting', tone: 'bg-accent-sky text-white' },
    { key: 'done', label: 'Done this week', tone: 'bg-success text-white' },
  ];
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {meta.map((col) => (
          <div key={col.key} className="lead-board-col" data-col={col.key}>
            <span className={cn('mb-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold', col.tone)}>
              <i className="h-2 w-2 rounded-full bg-white" />
              {col.label} <span className="opacity-75">{cols[col.key].length}</span>
            </span>
            <div className="flex flex-col gap-2">
              {cols[col.key].map((item) => (
                <InternWorkBoardCard key={item.id} item={item} dim={col.key === 'done'} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TimelineView({
  items,
  now,
  selectedDay,
}: {
  items: InternWorkItem[];
  now: Date;
  selectedDay: string | null;
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

  if (gantt.rows.length === 0 && gantt.later.length === 0) return <EmptyWork />;

  return (
    <div className="flex flex-col gap-3">
      <section className="surface overflow-x-auto p-3.5">
        <div className="lead-tl">
          <div className="lead-tl-head">
            <div className="min-w-0 px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-text-tertiary">
              Task
            </div>
            <div className="lead-tl-track">
              {gantt.window.map((ymd, i) => {
                const heading = formatIstWeekdayDay(ymd);
                const isToday = ymd === today;
                const isSelected = selectedDay === ymd;
                const weekend = heading.weekday === 'Sat' || heading.weekday === 'Sun';
                return (
                  <div
                    key={ymd}
                    id={isSelected ? 'intern-tl-day' : undefined}
                    className={cn(
                      'min-w-0 px-0.5 py-1 text-center text-[10.5px] font-extrabold leading-tight text-text-tertiary',
                      weekend && !isToday && 'opacity-45',
                      isToday && 'rounded-md bg-primary text-white',
                      isSelected && !isToday && 'rounded-md ring-2 ring-primary ring-offset-1 ring-offset-panel',
                    )}
                  >
                    <span className="block truncate">{heading.weekday}</span>
                    <span className="block tabular-nums">{heading.day}</span>
                    {i === 6 ? <span className="sr-only">End of this week</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
          {groups.map((group) => (
            <div key={group.id} className="lead-tl-company">
              <p className="min-w-0 truncate px-2 pt-2 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-text-tertiary">
                {group.name}
              </p>
              {group.rows.map((row) => (
                <div key={row.item.id} className="lead-tl-row">
                  <Link
                    href={row.item.href}
                    title={row.item.title}
                    className="min-w-0 truncate px-2 py-1.5 text-[12px] font-bold text-ink hover:underline"
                  >
                    {row.item.title}
                  </Link>
                  <div className="lead-tl-track">
                    {todayIdx >= 0 ? (
                      <span
                        className="lead-tl-today"
                        style={{ gridColumn: `${todayIdx + 1} / ${todayIdx + 2}` }}
                        aria-hidden
                      />
                    ) : null}
                    <Link
                      href={row.item.href}
                      title={`${row.item.title} · ${row.item.why}`}
                      className={cn(
                        'lead-tl-bar',
                        internToneBg(TIMELINE_PRIORITY_TONE[row.priority]),
                        row.priority === 'soon' ? 'text-warning-text' : 'text-white',
                        row.clippedStart && 'rounded-l-sm',
                        row.clippedEnd && 'rounded-r-sm',
                      )}
                      style={{
                        gridColumn: `${row.startIdx + 1} / ${row.endIdx + 2}`,
                      }}
                    >
                      <span className="min-w-0 truncate">{row.item.why}</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
      {gantt.later.length > 0 ? (
        <section className="surface p-3.5">
          <h2 className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-text-tertiary">
            Later / outside this fortnight
          </h2>
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {gantt.later.map((item) => (
              <TimelineWorkCard key={item.id} item={item} now={now} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TimelineWorkCard({
  item,
  now,
  compact,
}: {
  item: InternWorkItem;
  now: Date;
  compact?: boolean;
}) {
  const mark = internWeekMarkKind(item);
  const tone = mark ? WEEK_CHIP_TONE[mark] : KIND_TONE[item.kind] ?? 'info';
  return (
    <article
      className={cn(
        'min-w-0 rounded-md border border-border bg-panel p-2 shadow-layered',
        item.kind === 'done' && 'opacity-70',
      )}
    >
      <Link
        href={item.href}
        title={item.title}
        className={cn(
          'block text-[12px] font-bold leading-snug text-ink hover:underline',
          compact ? 'line-clamp-2' : 'truncate',
          item.kind === 'done' && 'text-text-tertiary line-through',
        )}
      >
        {item.title}
      </Link>
      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1">
        <LeadCompanyPill name={item.companyName} engagementId={item.engagementId} />
        <span
          className={cn(
            'inline-flex max-w-full truncate rounded-full px-1.5 py-0.5 text-[10px] font-extrabold',
            internToneBadge(tone),
          )}
        >
          {internKindChipLabel(item.kind)}
        </span>
      </div>
      <div className="mt-1 font-mono text-[10.5px] font-semibold text-text-tertiary">
        <span className={cn(item.isOverdue && internToneText('danger'))}>{formatDueLabel(item.dueAt, now)}</span>
      </div>
      <InternWorkCtaButton item={item} className="mt-1.5 w-full px-2 py-1 text-[10.5px]" />
    </article>
  );
}

function EmptyWork() {
  return (
    <div className="surface px-6 py-8 text-center">
      <p className="serif text-lg">Nothing in this view</p>
      <p className="mt-1 text-sm text-muted-foreground">Clear a filter or pick another company.</p>
    </div>
  );
}

export default function InternMyWork() {
  return (
    <Suspense fallback={<div className="serif text-lg">My work</div>}>
      <InternMyWorkInner />
    </Suspense>
  );
}
