'use client';

/**
 * COMPLIANCE CALENDAR — /app/manager/compliances/calendar (and the lead seat's
 * /app/intern/compliances/calendar). Prototype a59r `mxRenderers.calendar`:
 * company filter, Next deadline, the month's status ring, month navigation with
 * a month picker, area tabs with counts, Month / Year / Timeline, a Coming up
 * agenda; every count opens its breakdown and every row its card.
 *
 * Live functions kept (origin/main ComplianceCalendarView + StatutoryCalendar,
 * and the branch's CalendarLayoutStudio): one company picker for everything
 * (`?company=`), `?date=` opens that month and day, the register calendar of
 * the book with its month list and "this month's filings" link, SBC's
 * statutory calendar (source "SBC calendar": deadlines that apply to the
 * company or the book, act legend toggles with counts, All / Overdue, the day
 * list that a click on a day scrolls to, a deadline's note), the year of month
 * cards, full screen (remembered, Esc leaves), arrow keys on the month grid,
 * the pre-incorporation notice and portfolio note. Lead seat: no writes, and a
 * lead with no incorporated client goes to Today, as live.
 *
 * Never-empty rule: a client whose register has no rows this FY shows SBC's
 * calendar lines for it, marked SBC calendar, with a banner saying who and why.
 *
 * Non-statutory tasks (30 Oct 2026, spec rows C-1..C-4): an All · Statutory ·
 * Non-statutory switch above the calendar (`?cat=`, counts for the month in
 * Month view, for the year otherwise); tasks from `GET /api/compliances/tasks`
 * sit on their END date as a hollow "Task" square with the hover "Starts
 * <date> · <urgency>" and the six-word status chip, and a click opens the task
 * page. The switch applies to the month grid, the year, the timeline (a
 * Non-statutory lane with bars from start to end), the donut, Next deadline
 * and Coming up. An area pick hides tasks; Non-statutory hides the area switch.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AREA_LABEL, AREA_ORDER, fyStartOfMonth, mondayMonthGrid, monthLabel as monthLong, stepMonth, MON } from '@/lib/client-portal/compliances';
import { ACT_META, type StatutoryAct } from '@/data/statutory-calendar-fy2627';
import { readCalendarViewPrefs, writeCalendarViewPrefs } from '@/components/admin/statutory-calendar-utils';
import { fmtL } from '@/components/portal/dates';
import { SecError } from '@/components/portal/ui';
import { adminProjectStepPath } from '@/lib/projects/project-step-path';
import { useConsole, useConsolePalette, useCrumbs, type PaletteItem } from '../../runtime';
import { Drill, PopHead } from '../../overlays';
import { Btn, Donut, Empty, Icon, Legend, Panel, Seg } from '../../ui';
import { useToday } from '../today/useToday';
import { TeamItemDrawer } from '../today/TeamDrawer';
import { dDay, datedItems, dShort, late, plural, T_COLOR } from '../today/model';
import {
  ACT_ORDER,
  C_COLOR,
  C_LABEL,
  C_ORDER,
  TASK_ID_PREFIX,
  WORD_COLOR,
  actCounts,
  byDay,
  catCounts,
  catParam,
  comingUp,
  comingUpTasks,
  countSt,
  filterRows,
  filterTasks,
  lanes,
  monthDays,
  moveDay,
  nextItem,
  overdueRows,
  parseCat,
  rowItem,
  sbcItem,
  sbcRows,
  showStat,
  showTasks,
  taskBars,
  taskItem,
  taskPath,
  whenText,
  worstOf,
  yearCards,
  type AreaFilter,
  type CalItem,
  type Category,
  type CRow,
  type CSt,
  type SRow,
  type TaskBar,
  type TRow,
} from './model';
import { useBook, useComplianceBadges, useFyTasks, type BookData, type TaskData } from './data';
import { CategorySeg, ComplianceBanners, CompanySelect, FilingPop, LawTag, MonthPick, ReminderBtn, SbcPop, StPill, TaskMark, WordPill } from './shared';

type Source = 'book' | 'sbc';
type View = 'month' | 'year' | 'timeline';
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SS_VIEW = 'vcfo-cal-view';
const SS_SOURCE = 'vcfo-cal-source';

export function CalendarPage() {
  return (
    <Suspense fallback={<div className="glass panel mx-p"><div className="sec-load">Loading the calendar…</div></div>}>
      <Calendar />
    </Suspense>
  );
}

function readSS<T extends string>(key: string, ok: readonly T[], fallback: T): T {
  try {
    const v = sessionStorage.getItem(key);
    return ok.includes(v as T) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeSS(key: string, v: string) {
  try {
    sessionStorage.setItem(key, v);
  } catch {
    /* storage unavailable */
  }
}

const isoDay = (v: string | null): string | null => (v && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null);

function Calendar() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const { base, go, openPop, pop, modal, drawer } = useConsole();
  useComplianceBadges();

  const dateParam = isoDay(params.get('date'));
  /* C-1: All · Statutory · Non-statutory, kept in `?cat=` so a refresh keeps it */
  const cat = parseCat(params.get('cat'));
  const setCat = (c: Category) => {
    const s = new URLSearchParams(params.toString());
    const v = catParam(c);
    if (v) s.set('cat', v);
    else s.delete('cat');
    const q = s.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };
  const [month, setMonth] = useState<string>(() => (dateParam ?? new Date(Date.now() + 330 * 60_000).toISOString()).slice(0, 7));
  const [picked, setPicked] = useState<string>(() => params.get('company') ?? 'all');
  const [area, setArea] = useState<AreaFilter>('all');
  const [source, setSourceState] = useState<Source>('book');
  const [view, setViewState] = useState<View>('month');
  const [side, setSide] = useState<'soon' | 'month'>('soon');
  const [sbcScope, setSbcScope] = useState<'all' | 'over'>('all');
  const [muted, setMuted] = useState<Set<StatutoryAct>>(() => new Set());
  const [full, setFull] = useState(false);
  const [sel, setSel] = useState<string | null>(dateParam);
  useEffect(() => {
    setSourceState(readSS<Source>(SS_SOURCE, ['book', 'sbc'], 'book'));
    setViewState(readSS<View>(SS_VIEW, ['month', 'year', 'timeline'], 'month'));
    if (readCalendarViewPrefs().mode === 'maximized') setFull(true);
  }, []);
  const setSource = (s: Source) => {
    setSourceState(s);
    writeSS(SS_SOURCE, s);
  };
  const setView = (v: View) => {
    setViewState(v);
    writeSS(SS_VIEW, v);
  };
  const setFullMode = useCallback((on: boolean) => {
    setFull(on);
    writeCalendarViewPrefs({ mode: on ? 'maximized' : 'minimized' });
  }, []);

  const fy = fyStartOfMonth(month);
  const data = useBook(fy);
  const { book } = data;
  const today = book.today;
  const sole = book.clients.length === 1 ? book.clients[0] : undefined;
  const company = sole ? sole.id : book.byId[picked]?.inScope ? picked : 'all';
  const companyName = company !== 'all' ? book.byId[company]?.short : undefined;
  useCrumbs(companyName ? ['Compliance calendar', companyName] : ['Compliance calendar']);

  useEffect(() => {
    if (data.leadHasNothing) router.replace(`${base}/today`);
  }, [data.leadHasNothing, router, base]);

  /* ---------- rows of each source */
  const scoped = useMemo(() => filterRows(book.rows, { company }), [book.rows, company]);
  const shownAreaRows = useMemo(() => filterRows(scoped, { area }), [scoped, area]);
  /** the statutory rows on screen: none when the switch says Non-statutory */
  const shown = useMemo(() => (showStat(cat) ? shownAreaRows : []), [shownAreaRows, cat]);
  /* C-3 / C-4: the FY's non-statutory tasks on their end date; an area pick hides them (a task has no regulator) */
  const td = useFyTasks(fy, book);
  const scopedTasks = useMemo(() => filterTasks(td.tasks, { company }), [td.tasks, company]);
  const shownTasks = useMemo(() => (showTasks(cat) && area === 'all' ? scopedTasks : []), [scopedTasks, cat, area]);
  const monthTasks = useMemo(() => shownTasks.filter((t) => t.due.slice(0, 7) === month), [shownTasks, month]);
  const sbcAll = useMemo(() => sbcRows({ today, clients: book.clients, company, firmWide: data.firmWide }), [today, book.clients, company, data.firmWide]);
  const sbcShown = useMemo(
    () => sbcAll.filter((s) => (area === 'all' || s.area === area) && !muted.has(s.act) && (sbcScope === 'all' || s.st === 'o')),
    [sbcAll, area, muted, sbcScope],
  );
  const showClient = company === 'all';
  const items: CalItem[] = useMemo(
    () => (source === 'book' ? [...shown.map((r) => rowItem(r, showClient)), ...shownTasks.map((t) => taskItem(t, showClient))].sort((a, b) => a.due.localeCompare(b.due)) : sbcShown.map(sbcItem)),
    [source, shown, shownTasks, sbcShown, showClient],
  );
  const monthItems = useMemo(() => items.filter((i) => i.due.slice(0, 7) === month), [items, month]);
  /* C-1 counts: the month in Month view, the financial year in Year and Timeline (before the area pick, like the area counts) */
  const catN = useMemo(() => {
    const inView = (d: string) => view !== 'month' || d.slice(0, 7) === month;
    return catCounts(scoped.filter((r) => inView(r.due)), scopedTasks.filter((t) => inView(t.due)));
  }, [scoped, scopedTasks, view, month]);
  const bars = useMemo(() => (source === 'book' ? taskBars(shownTasks, month) : []), [source, shownTasks, month]);
  const areaCounts = useMemo(() => {
    const base0: Array<{ due: string; area: string | null }> =
      source === 'book' ? scoped : sbcAll.filter((s) => !muted.has(s.act) && (sbcScope === 'all' || s.st === 'o'));
    const inMonth = base0.filter((r) => r.due.slice(0, 7) === month);
    const out = { all: inMonth.length } as Record<AreaFilter, number>;
    for (const a of AREA_ORDER) out[a] = inMonth.filter((r) => r.area === a).length;
    return out;
  }, [source, scoped, sbcAll, muted, sbcScope, month]);

  /* ---------- opening things */
  const openTask = useCallback((taskId: string) => go(taskPath(base, taskId)), [go, base]);
  const openItem = useCallback(
    (it: CalItem, el: Element | null, push = false) => {
      if (it.kind === 'sbc') {
        const s = sbcAll.find((x) => x.id === it.id);
        if (s) openPop(el, <SbcPop s={s} names={s.clients.map((id) => book.byId[id]?.short ?? id)} />, { push, cls: 'mx-wide' });
        return;
      }
      if (it.kind === 'task') {
        openTask(it.id.slice(TASK_ID_PREFIX.length));
        return;
      }
      openPop(el, <FilingPop id={it.id} fy={fy} />, { push, cls: 'mx-wide' });
    },
    [openPop, sbcAll, book.byId, fy, openTask],
  );
  const openDay = useCallback(
    (day: string, el: Element | null) => {
      setSel(day);
      if (source === 'sbc') {
        const list = sbcShown.filter((s) => s.due === day);
        openPop(el, <SbcDayPop day={day} rows={list} onOpen={(s, e) => openItem(sbcItem(s), e, true)} />);
        requestAnimationFrame(() => document.getElementById(`cf-ag-${day}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
        return;
      }
      openPop(el, <DayPop day={day} fy={fy} company={company} area={area} stat={showStat(cat)} tasks={shownTasks.filter((t) => t.due === day)} onOpen={(it, e) => openItem(it, e, true)} />);
    },
    [source, sbcShown, openPop, openItem, fy, company, area, cat, shownTasks],
  );

  /* ?date= opens that day once the book is in */
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !dateParam || data.loading) return;
    opened.current = true;
    const el = document.querySelector(`[data-day="${dateParam}"]`);
    if (el && (shown.some((r) => r.due === dateParam) || shownTasks.some((t) => t.due === dateParam))) openDay(dateParam, el);
  }, [dateParam, data.loading, shown, shownTasks, openDay]);

  /* full screen: Esc leaves (after any open card), the page behind does not scroll */
  useEffect(() => {
    if (!full) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !pop && !modal && !drawer) setFullMode(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [full, pop, modal, drawer, setFullMode]);

  /* search: the FY's register filings and non-statutory tasks */
  const palette = useMemo<PaletteItem[]>(
    () => [
      ...book.rows
        .filter((r) => !r.cal)
        .slice(0, 300)
        .map((r) => ({
          id: `filing:${r.id}`,
          label: `${r.name}${r.period ? ` · ${r.period}` : ''} · ${book.byId[r.clientId]?.short ?? r.clientName}`,
          kind: `Filing · ${dShort(r.due, today)} · ${C_LABEL[r.st]}`,
          sw: C_COLOR[r.st],
          go: () => go(`${base}/compliances/calendar?date=${r.due}&company=${r.clientId}`),
        })),
      ...td.tasks.slice(0, 100).map((t) => ({
        id: t.id,
        label: `${t.title} · ${book.byId[t.clientId]?.short ?? t.clientName}`,
        kind: `Task · ends ${dShort(t.due, today)} · ${t.word}`,
        sw: WORD_COLOR[t.word],
        go: () => openTask(t.taskId),
      })),
    ],
    [book.rows, book.byId, today, go, base, td.tasks, openTask],
  );
  useConsolePalette('compliance-calendar', palette);

  const companyQ = company !== 'all' && !sole ? `&company=${company}` : '';
  const filingsHref = `${base}/compliances/filings?cadence=monthly&period=${month}&fy=${fy}${companyQ}`;

  const shift = (k: number) => setMonth(stepMonth(month, view === 'year' ? k * 12 : k));
  const thisMonth = today.slice(0, 7);

  const toolbar = (
    <div className="mx-tb">
      <div className="mx-mnav">
        <button type="button" className="ib sm" aria-label={view === 'year' ? 'Previous financial year' : 'Previous month'} onClick={() => shift(-1)}>
          <Icon name="back" />
        </button>
        <button type="button" className="btn sm" aria-label="Pick a month" onClick={(e) => openPop(e.currentTarget, <MonthPick value={month} onPick={setMonth} />, { cls: 'mx-narrow' })}>
          {view === 'year' ? book.fyLabel : monthLong(month)}
          <Icon name="down" size={12} />
        </button>
        <button type="button" className="ib sm" aria-label={view === 'year' ? 'Next financial year' : 'Next month'} onClick={() => shift(1)}>
          <Icon name="chev" />
        </button>
      </div>
      {month !== thisMonth ? (
        <Btn cls="sm" onClick={() => setMonth(thisMonth)}>
          Today
        </Btn>
      ) : null}
      {source === 'book' ? <CategorySeg value={cat} counts={td.loading && !td.tasks.length ? { all: '–', statutory: catN.statutory, 'non-statutory': '–' } : catN} onChange={setCat} /> : null}
      {source === 'sbc' || cat !== 'non-statutory' ? (
        <Seg<AreaFilter>
          className="sm"
          ariaLabel="Filter by area"
          value={area}
          onChange={setArea}
          options={[{ value: 'all', label: 'All', n: areaCounts.all }, ...AREA_ORDER.map((a) => ({ value: a, label: AREA_LABEL[a], n: areaCounts[a] }))]}
        />
      ) : null}
      <span className="sp" />
      <Seg<Source>
        className="sm"
        ariaLabel="What the calendar shows"
        value={source}
        onChange={setSource}
        options={[
          { value: 'book', label: 'Your clients' },
          { value: 'sbc', label: 'SBC calendar' },
        ]}
      />
      <Seg<View>
        className="sm"
        ariaLabel="Calendar view"
        value={view}
        onChange={setView}
        options={[
          { value: 'month', label: 'Month' },
          { value: 'year', label: 'Year' },
          { value: 'timeline', label: 'Timeline' },
        ]}
      />
    </div>
  );

  const body = (
    <section className="glass panel cf-body">
      {data.loading ? (
        <div className="sec-load">Loading the calendar…</div>
      ) : data.error && source === 'book' ? (
        <SecError message="The filings register could not load." onRetry={data.retry} />
      ) : view === 'month' ? (
        <MonthGrid month={month} today={today} items={monthItems} sel={sel} onDay={openDay} onOpen={(it, el) => openItem(it, el)} sbc={source === 'sbc'} />
      ) : view === 'year' ? (
        <YearView
          fy={fy}
          today={today}
          items={items}
          onMonth={(k) => {
            setMonth(k);
            setView('month');
          }}
          onDay={openDay}
        />
      ) : (
        <TimelineView month={month} today={today} items={items.filter((i) => i.kind !== 'task')} bars={bars} area={area} stat={source === 'sbc' || showStat(cat)} onDay={openDay} onTask={openTask} />
      )}
      {source === 'sbc' && !data.loading ? (
        <ActLegend rows={sbcAll.filter((s) => s.due.slice(0, 7) === month && (sbcScope === 'all' || s.st === 'o'))} muted={muted} setMuted={setMuted} />
      ) : (
        <StatusLegend tasks={showTasks(cat)} />
      )}
      {source === 'book' && showTasks(cat) && td.error ? (
        <p className="small cf-note" role="status">
          The non-statutory tasks could not load.{' '}
          <button type="button" className="link" onClick={td.retry}>
            Try again
          </button>
        </p>
      ) : null}
      {source === 'sbc' && month.slice(0, 4) !== '2026' && !(month.slice(0, 4) === '2027' && month < '2027-04') ? (
        <p className="small cf-note">SBC’s compliance calendar covers FY 2026-27 (April 2026 to March 2027).</p>
      ) : null}
    </section>
  );

  return (
    <>
      <div className="sec-h">
        <h2>Compliance calendar</h2>
        <span className="sec-count">{book.fyLabel}</span>
        <span className="sp" />
        {book.clients.length > 1 ? <CompanySelect clients={book.clients} value={company} onChange={(v) => { setPicked(v); setSel(null); }} /> : null}
        <Btn cls="sm" ico="ne" onClick={() => setFullMode(true)}>
          Full screen
        </Btn>
        <Btn cls="sm" ico="calc" onClick={() => go(`${base}/compliances/filings${companyQ ? `?${companyQ.slice(1)}` : ''}`)}>
          Filings
        </Btn>
      </div>

      {!data.loading ? <ComplianceBanners book={book} company={company} /> : null}

      <div className="mx-ctop">
        {source === 'book' ? (
          <>
            <NextPanel d={data} td={td} rows={showStat(cat) ? scoped : []} tasks={showTasks(cat) && area === 'all' ? scopedTasks : []} onOpen={(r, el) => openItem(rowItem(r, true), el)} onTask={openTask} filingsHref={filingsHref} />
            <MixPanel d={data} rows={shown.filter((r) => r.due.slice(0, 7) === month)} tasks={monthTasks} month={month} onOpen={(r) => openItem(rowItem(r, true), null)} onTask={openTask} filingsHref={filingsHref} cat={cat} />
          </>
        ) : (
          <>
            <SbcNextPanel loading={data.loading} rows={sbcShown} today={today} onOpen={(s, el) => openItem(sbcItem(s), el)} />
            <SbcMixPanel rows={sbcShown.filter((s) => s.due.slice(0, 7) === month)} month={month} onOpen={(s) => openItem(sbcItem(s), null)} />
          </>
        )}
      </div>

      {toolbar}

      <div className="mx-row21 cal">
        {full ? <section className="glass panel cf-body"><div className="sec-load">Showing full screen · press Esc to leave</div></section> : body}
        {source === 'book' ? (
          <Agenda
            loading={data.loading}
            title={side === 'soon' ? 'Coming up' : monthLong(month)}
            sub={
              side === 'soon'
                ? `Next 14 days · ${showTasks(cat) && !showStat(cat) ? 'open tasks' : showTasks(cat) ? 'not filed or done yet' : 'not filed yet'}`
                : [showStat(cat) ? plural(shown.filter((r) => r.due.slice(0, 7) === month).length, 'filing') : '', showTasks(cat) ? plural(monthTasks.length, 'task') : ''].filter(Boolean).join(' · ')
            }
            act={
              <Seg<'soon' | 'month'>
                className="sm"
                ariaLabel="Which list"
                value={side}
                onChange={setSide}
                options={[
                  { value: 'soon', label: 'Coming up' },
                  { value: 'month', label: MON[Number(month.slice(5, 7)) - 1]! },
                ]}
              />
            }
            items={[
              ...(side === 'soon' ? comingUp(shown, today) : shown.filter((r) => r.due.slice(0, 7) === month)).map((r) => rowItem(r, showClient)),
              ...(side === 'soon' ? comingUpTasks(shownTasks, today) : monthTasks).map((t) => taskItem(t, showClient)),
            ].sort((a, b) => a.due.localeCompare(b.due))}
            today={today}
            sel={sel}
            empty={
              side === 'soon'
                ? ['A quiet fortnight', showTasks(cat) ? 'Nothing unfiled and no open task falls due in the next 14 days.' : 'Nothing unfiled falls due in the next 14 days.']
                : ['Nothing falls due in this month', showStat(cat) ? 'Filings due this month appear here as the register fills.' : 'Tasks ending this month appear here once a manager creates them.']
            }
            onOpen={openItem}
          />
        ) : (
          <Agenda
            loading={data.loading}
            title={`${MON[Number(month.slice(5, 7)) - 1]} · ${plural(monthItems.length, 'deadline')}`}
            sub="SBC’s compliance calendar"
            act={
              <Seg<'all' | 'over'>
                className="sm"
                ariaLabel="Filter deadlines"
                value={sbcScope}
                onChange={setSbcScope}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'over', label: 'Overdue' },
                ]}
              />
            }
            items={monthItems}
            today={today}
            sel={sel}
            empty={[`No deadlines in ${monthLong(month)} for these filters`, 'Change the area, the act legend or the month.']}
            onOpen={openItem}
          />
        )}
      </div>

      {full ? <FullScreen onClose={() => setFullMode(false)} title={`Compliance calendar · ${view === 'year' ? book.fyLabel : monthLong(month)}`} toolbar={toolbar} body={body} /> : null}
    </>
  );
}

/* ================================================================ full screen (live StatutoryMaxiCalendar) */

function FullScreen({ onClose, title, toolbar, body }: { onClose: () => void; title: string; toolbar: ReactNode; body: ReactNode }) {
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => setHost(document.querySelector('.cpx')), []);
  if (!host) return null;
  return createPortal(
    <div className="cf-full" role="dialog" aria-modal="true" aria-label={title}>
      <div className="cf-fullh">
        <h3>{title}</h3>
        <span className="sp" />
        <Btn cls="sm" ico="x" title="Leave full screen (Esc)" onClick={onClose}>
          Leave full screen
        </Btn>
      </div>
      {toolbar}
      {body}
    </div>,
    host,
  );
}

/* ================================================================ month grid */

function MonthGrid({
  month,
  today,
  items,
  sel,
  onDay,
  onOpen,
  sbc,
}: {
  month: string;
  today: string;
  items: CalItem[];
  sel: string | null;
  onDay: (day: string, el: Element | null) => void;
  onOpen: (it: CalItem, el: Element) => void;
  sbc: boolean;
}) {
  const days = useMemo(() => byDay(items), [items]);
  const cells = useMemo(() => mondayMonthGrid(month), [month]);
  const [focus, setFocus] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const roving = focus && focus.slice(0, 7) === month ? focus : today.slice(0, 7) === month ? today : `${month}-01`;
  const onKey = (e: KeyboardEvent<HTMLElement>, iso: string) => {
    const next = moveDay(iso, e.key);
    if (!next) return;
    e.preventDefault();
    setFocus(next);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`[data-day="${next}"]`)?.focus());
  };
  return (
    <div ref={ref} className="mx-mv cal" role="group" aria-label={`${monthLong(month)} · arrow keys move between days, Enter opens a day`}>
      {WEEK.map((d) => (
        <span key={d} className="mx-mvh" aria-hidden="true">
          {d}
        </span>
      ))}
      {cells.map((c) => {
        if (c.out)
          return (
            <div key={c.iso} className="mx-mvc out" aria-hidden="true">
              <div className="mx-mvn">
                <b>{c.day}</b>
              </div>
            </div>
          );
        const list = days.get(c.iso) ?? [];
        const worst = worstOf(list.map((i) => i.st));
        const wk = ['Sat', 'Sun'].includes(new Date(`${c.iso}T00:00:00Z`).toUTCString().slice(0, 3));
        const nTasks = list.filter((i) => i.kind === 'task').length;
        const tip = `${fmtL(c.iso)}${c.iso === today ? ' · today' : ''} · ${
          list.length ? [list.length - nTasks ? plural(list.length - nTasks, sbc ? 'deadline' : 'filing') : '', nTasks ? plural(nTasks, 'task') : ''].filter(Boolean).join(' · ') : 'nothing due'
        }`;
        return (
          <div
            key={c.iso}
            role="button"
            tabIndex={c.iso === roving ? 0 : -1}
            data-day={c.iso}
            title={tip}
            aria-label={tip}
            className={'mx-mvc cf-mvc' + (c.iso === today ? ' now' : '') + (wk ? ' wk' : '') + (c.iso === sel ? ' cf-sel' : '')}
            onClick={(e) => onDay(c.iso, e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onDay(c.iso, e.currentTarget);
              } else onKey(e, c.iso);
            }}
          >
            <div className="mx-mvn">
              <b className={worst === 'o' ? 'over' : worst === 'd' ? 'due' : list.length ? 'has' : ''}>{c.day}</b>
              {list.length > 2 ? <em>{list.length}</em> : null}
            </div>
            {list.slice(0, 2).map((it) => (
              <button
                key={it.id}
                type="button"
                tabIndex={-1}
                className={'mx-fchip cf-chip' + (it.st === 'c' ? ' cf-cal' : '') + (it.kind === 'task' ? ' cf-task' : '')}
                style={{ ['--cc' as string]: C_COLOR[it.st] }}
                title={it.kind === 'task' ? `${it.title}${it.sub ? ` · ${it.sub}` : ''} · ${it.hint} · ${it.word}` : `${it.title}${it.sub ? ` · ${it.sub}` : ''} · ${C_LABEL[it.st]}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(it, e.currentTarget);
                }}
              >
                {it.kind === 'task' ? <TaskMark done={it.word === 'Done'} title={it.hint} /> : <LawTag area={it.area} tag={it.tag} />}
                <span className="cf-ell">{it.title}</span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================ year */

function YearView({ fy, today, items, onMonth, onDay }: { fy: number; today: string; items: CalItem[]; onMonth: (key: string) => void; onDay: (day: string, el: Element | null) => void }) {
  const cards = useMemo(() => yearCards(items, fy), [items, fy]);
  const days = useMemo(() => byDay(items), [items]);
  const now = today.slice(0, 7);
  return (
    <div className="mx-year">
      {cards.map((m) => {
        const segs = C_ORDER.filter((s) => m.counts[s]);
        return (
          <div key={m.key} className={'mx-ym cf-ym' + (m.key === now ? ' now' : '') + (m.key < now ? ' prev' : '')}>
            <button type="button" className="cf-ymh" onClick={() => onMonth(m.key)} title={`Open ${m.label}`}>
              <b>{m.label}</b>
              <span>{m.n ? plural(m.n, 'item') : 'Nothing due'}</span>
            </button>
            <div className="mx-ymb cf-ymb" role="img" aria-label={segs.map((s) => `${C_LABEL[s]} ${m.counts[s]}`).join(', ') || 'Nothing due'}>
              {segs.map((s) => (
                <i key={s} style={{ width: `${(m.counts[s] / m.n) * 100}%`, background: C_COLOR[s] }} title={`${C_LABEL[s]} · ${m.counts[s]}`} />
              ))}
            </div>
            <div className="cf-ymg">
              {mondayMonthGrid(m.key).map((c) => {
                if (c.out) return <span key={c.iso} />;
                const list = days.get(c.iso) ?? [];
                const w = worstOf(list.map((i) => i.st));
                return list.length ? (
                  <button
                    key={c.iso}
                    type="button"
                    className={'cf-yd' + (c.iso === today ? ' now' : '')}
                    style={{ ['--cc' as string]: w ? C_COLOR[w] : undefined }}
                    title={`${fmtL(c.iso)} · ${plural(list.length, 'item')}`}
                    aria-label={`${fmtL(c.iso)} · ${plural(list.length, 'item')}`}
                    onClick={(e) => onDay(c.iso, e.currentTarget)}
                  >
                    {c.day}
                  </button>
                ) : (
                  <span key={c.iso} className={'cf-yd off' + (c.iso === today ? ' now' : '')}>
                    {c.day}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================ timeline */

/** Bars that overlap share no row: the first row with room takes the bar (the lane grows by one row per overlap). */
function stackBars(bars: TaskBar[]): Array<TaskBar & { row: number }> {
  const ends: number[] = [];
  return bars.map((b) => {
    let row = ends.findIndex((e) => e < b.from);
    if (row < 0) row = ends.length;
    ends[row] = b.to;
    return { ...b, row };
  });
}

function TimelineView({
  month,
  today,
  items,
  bars,
  area,
  stat,
  onDay,
  onTask,
}: {
  month: string;
  today: string;
  items: CalItem[];
  /** C-4: the non-statutory lane, a bar per task from its start date to its end date */
  bars: TaskBar[];
  area: AreaFilter;
  /** statutory lanes on (off when the switch says Non-statutory) */
  stat: boolean;
  onDay: (day: string, el: Element | null) => void;
  onTask: (taskId: string) => void;
}) {
  const n = monthDays(month);
  const ls = useMemo(() => (stat ? lanes(items, month, area) : []), [items, month, area, stat]);
  const stacked = useMemo(() => stackBars(bars), [bars]);
  const rows = stacked.reduce((m, b) => Math.max(m, b.row + 1), 0);
  const nowDay = today.slice(0, 7) === month ? Number(today.slice(8, 10)) : 0;
  const ticks = [1, 5, 10, 15, 20, 25, n];
  return (
    <div className="mx-ftl">
      {!ls.length && !bars.length ? <Empty title={`Nothing in ${monthLong(month)}`} sub={stat ? 'Filings and tasks of this month appear here by day.' : 'Tasks that run through this month appear here as bars from start to end.'} /> : null}
      {bars.length ? (
        <div className="mx-ftr">
          <span className="mx-ftn">
            <TaskMark word={false} />
            Non-statutory
          </span>
          <div className="mx-ftt cf-tlane" style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, height: `${Math.max(36, 10 + rows * 16)}px` }}>
            {Array.from({ length: n }, (_, i) => (
              <i key={i} className={'mx-tlc' + (i + 1 === nowDay ? ' now' : '')} />
            ))}
            {stacked.map((b) => (
              <button
                key={b.t.id}
                type="button"
                className={'cf-tbar' + (b.cutStart ? ' cut-s' : '') + (b.cutEnd ? ' cut-e' : '')}
                style={{ left: `${((b.from - 1) / n) * 100}%`, width: `${((b.to - b.from + 1) / n) * 100}%`, top: `${5 + b.row * 16}px`, ['--cc' as string]: WORD_COLOR[b.t.word] }}
                title={`${b.t.title} · ${b.t.clientName} · ${b.t.hint} · ends ${dDay(b.t.due, today)} · ${b.t.word}`}
                aria-label={`${b.t.title} · ${b.t.clientName} · ${b.t.hint} · ends ${dDay(b.t.due, today)} · ${b.t.word} · open the task`}
                onClick={() => onTask(b.t.taskId)}
              />
            ))}
          </div>
        </div>
      ) : null}
      {ls.map((l) => (
        <div key={l.key} className="mx-ftr">
          <span className="mx-ftn">
            <LawTag area={l.area} tag={l.area ?? 'Other'} />
            {l.label}
          </span>
          <div className="mx-ftt" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
            {Array.from({ length: n }, (_, i) => (
              <i key={i} className={'mx-tlc' + (i + 1 === nowDay ? ' now' : '')} />
            ))}
            {l.days.map(({ day, items: list }) => {
              const w = worstOf(list.map((i) => i.st))!;
              const iso = `${month}-${String(day).padStart(2, '0')}`;
              return (
                <button
                  key={day}
                  type="button"
                  className="mx-fdot cf-fdot"
                  style={{ left: `${((day - 0.5) / n) * 100}%`, ['--cc' as string]: C_COLOR[w] }}
                  title={`${dDay(iso, today)} · ${list.map((i) => i.title).join(', ')} · ${C_LABEL[w]}`}
                  aria-label={`${dDay(iso, today)} · ${plural(list.length, 'item')} in ${l.label}`}
                  onClick={(e) => onDay(iso, e.currentTarget)}
                >
                  {list.length > 1 ? list.length : ''}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="mx-ftax" aria-hidden="true">
        {ticks.map((d) => (
          <span key={d} style={{ left: `${((d - 0.5) / n) * 100}%` }}>
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ================================================================ legends */

function StatusLegend({ tasks }: { tasks: boolean }) {
  return (
    <div className="mx-phleg cf-leg" aria-label="What the colours and marks mean">
      {C_ORDER.map((s) => (
        <span key={s} title={C_LABEL[s]}>
          <i className="cf-sw" style={{ background: C_COLOR[s] }} />
          {C_LABEL[s]}
        </span>
      ))}
      {tasks ? (
        <span title="A non-statutory task, shown on its end date; hover for its start date and urgency, click to open it. Green once done.">
          <i className="cf-tsq" />
          Task · on its end date
        </span>
      ) : null}
    </div>
  );
}

/** Live legend: each act a toggle with its count this month; "Select all" when any is off. */
function ActLegend({ rows, muted, setMuted }: { rows: SRow[]; muted: Set<StatutoryAct>; setMuted: (s: Set<StatutoryAct>) => void }) {
  const n = actCounts(rows);
  return (
    <div className="cf-acts2" role="group" aria-label="Acts">
      <span className="eyebrow">Acts</span>
      {ACT_ORDER.map((a) => {
        const off = muted.has(a);
        const s = rows.find((r) => r.act === a);
        return (
          <button
            key={a}
            type="button"
            className={'mx-lg cf-act' + (off ? ' off' : '')}
            aria-pressed={!off}
            title={`${ACT_META[a].full} · ${off ? 'hidden, click to show' : 'click to hide'}`}
            onClick={() => {
              const next = new Set(muted);
              if (off) next.delete(a);
              else next.add(a);
              setMuted(next);
            }}
          >
            <LawTag area={s?.area ?? null} tag={ACT_META[a].label} title={ACT_META[a].full} />
            <b>{n[a]}</b>
          </button>
        );
      })}
      {muted.size ? (
        <button type="button" className="link" onClick={() => setMuted(new Set())}>
          Select all
        </button>
      ) : null}
      <span className="small cf-note">The colours on this view are the date: overdue (passed), due this week, upcoming.</span>
    </div>
  );
}

/* ================================================================ agenda (Coming up / the month / SBC day list) */

function Agenda({
  loading,
  title,
  sub,
  act,
  items,
  today,
  sel,
  empty,
  onOpen,
}: {
  loading: boolean;
  title: string;
  sub: string;
  act: ReactNode;
  items: CalItem[];
  today: string;
  sel: string | null;
  empty: [string, string];
  onOpen: (it: CalItem, el: Element) => void;
}) {
  const days = [...byDay(items).entries()];
  return (
    <Panel title={title} sub={sub} act={act} cls="cf-agenda">
      {loading ? (
        <div className="sec-load">Loading…</div>
      ) : days.length ? (
        days.map(([d, list]) => (
          <div key={d} id={`cf-ag-${d}`} className={'mx-agd' + (d === sel ? ' cf-flash' : '')}>
            <b className="mx-agh">{`${dDay(d, today)}${d === today ? ' · today' : ''}`}</b>
            {list.map((it) => (
              <button key={it.id} type="button" className="mx-agi" title={it.kind === 'task' ? `${it.hint} · open the task` : undefined} onClick={(e) => onOpen(it, e.currentTarget)}>
                {it.kind === 'task' ? <TaskMark done={it.word === 'Done'} title={it.hint} /> : <LawTag area={it.area} tag={it.tag} />}
                <span className="mx-dt">
                  <b className="cf-ell" title={it.title}>
                    {it.title}
                  </b>
                  {it.sub || it.hint ? (
                    <span className="cf-ell" title={it.kind === 'task' ? [it.sub, it.hint].filter(Boolean).join(' · ') : it.sub}>
                      {it.kind === 'task' ? [it.sub, it.hint].filter(Boolean).join(' · ') : it.sub}
                    </span>
                  ) : null}
                </span>
                {it.kind === 'task' && it.word ? <WordPill word={it.word} /> : <StPill st={it.st} label={it.st === 'd' ? 'Due' : undefined} />}
              </button>
            ))}
          </div>
        ))
      ) : (
        <Empty title={empty[0]} sub={empty[1]} />
      )}
    </Panel>
  );
}

/* ================================================================ next deadline + month mix (your clients) */

function NextPanel({
  d,
  td,
  rows,
  tasks,
  onOpen,
  onTask,
  filingsHref,
}: {
  d: BookData;
  td: TaskData;
  rows: CRow[];
  /** C-4: the open tasks in view; the next deadline is the earlier of the next filing and the next task */
  tasks: TRow[];
  onOpen: (r: CRow, el: Element | null) => void;
  onTask: (taskId: string) => void;
  filingsHref: string;
}) {
  const { openPop, go } = useConsole();
  const today = d.book.today;
  const ni = nextItem(rows, tasks, today);
  const next = ni?.kind === 'filing' ? ni.r : undefined;
  const nextTask = ni?.kind === 'task' ? ni.t : undefined;
  const over = overdueRows(rows);
  const overTasks = tasks.filter((t) => t.st === 'o');
  const nOver = over.length + overTasks.length;
  const first = over[0] && (!overTasks[0] || over[0].due <= overTasks[0].due) ? { title: `${over[0].name} · ${over[0].clientName}`, days: -over[0].days } : overTasks[0] ? { title: `${overTasks[0].title} · ${overTasks[0].clientName}`, days: -overTasks[0].days } : undefined;
  if (d.loading)
    return (
      <Panel title="Next deadline">
        <div className="sec-load">Loading…</div>
      </Panel>
    );
  return (
    <Panel title="Next deadline" sub={ni ? dDay(ni.kind === 'filing' ? ni.r.due : ni.t.due, today) : undefined}>
      {nextTask ? (
        <div className="mx-nd">
          <div className="mx-ndh">
            <b className="mx-ndn">{nextTask.days === 0 ? 'Today' : plural(nextTask.days, 'day')}</b>
            <span className="mx-dt">
              <b className="cf-ell" title={nextTask.title}>
                {nextTask.title}
              </b>
              <span className="cf-ell">{[nextTask.clientName, nextTask.owner ? `with ${nextTask.owner}` : ''].filter(Boolean).join(' · ')}</span>
            </span>
          </div>
          <div className="mx-chips">
            <TaskMark done={nextTask.done} title={nextTask.hint} />
            <WordPill word={nextTask.word} />
            <span className="pill mut" title={`Urgency ${nextTask.urgency} · ${nextTask.bars} of 4`}>{`Urgency · ${nextTask.urgency}`}</span>
            <span className="pill mut" title="The task runs from its start date to its end date">{nextTask.hint}</span>
          </div>
          <div className="mx-apa">
            <Btn cls="sm pri" ico="step" onClick={() => onTask(nextTask.taskId)}>
              Open task
            </Btn>
          </div>
        </div>
      ) : next ? (
        <div className="mx-nd">
          <div className="mx-ndh">
            <b className="mx-ndn">{next.days === 0 ? 'Today' : plural(next.days, 'day')}</b>
            <span className="mx-dt">
              <b className="cf-ell" title={`${next.name} · ${next.period}`}>
                {[next.name, next.period].filter(Boolean).join(' · ')}
              </b>
              <span className="cf-ell">{next.clientName}</span>
            </span>
            <button type="button" className="ib sm" aria-label="About this filing" title="About this filing" onClick={(e) => onOpen(next, e.currentTarget)}>
              <Icon name="help" />
            </button>
          </div>
          <div className="mx-chips">
            <LawTag area={next.area} tag={next.area} />
            <StPill st={next.st} />
            {next.portal?.dataReceivedOn ? <span className="pill ok">{`Data received ${dShort(next.portal.dataReceivedOn, today)}`}</span> : null}
            {next.window ? <span className="pill mut" title="The working window the manager set">{`Window ${dShort(next.window.from, today)} – ${dShort(next.window.to, today)}`}</span> : null}
          </div>
          <div className="mx-apa">
            <Btn cls="sm pri" ico="calc" onClick={(e) => onOpen(next, e.currentTarget)}>
              Open filing
            </Btn>
            <ReminderBtn r={next} />
          </div>
        </div>
      ) : (
        <Empty
          title="Nothing due from today"
          sub={rows.length && tasks.length ? 'Every filing this year is filed or past its date, and every task is done or past its end date.' : tasks.length || !rows.length ? 'Every task this year is done or past its end date.' : 'Every filing on the register this year is filed or past its date.'}
        />
      )}
      {td.loading && !rows.length ? <div className="sec-load">Loading the tasks…</div> : null}
      {nOver && first ? (
        <button
          type="button"
          className="banner over cf-banbtn"
          onClick={(e) =>
            openPop(
              e.currentTarget,
              <Drill
                title={over.length && overTasks.length ? 'Overdue filings and tasks' : over.length ? 'Overdue filings' : 'Overdue tasks'}
                sub={[over.length ? plural(over.length, 'filing') : '', overTasks.length ? plural(overTasks.length, 'task') : ''].filter(Boolean).join(' · ')}
                tabs={[
                  ...(over.length ? [{ label: 'Filings', color: C_COLOR.o, rows: over.map((r) => ({ id: r.id, title: `${r.name} · ${r.clientName}`, meta: `Was due ${dShort(r.due, today)}`, state: late(-r.days), color: C_COLOR.o, onOpen: () => onOpen(r, null) })) }] : []),
                  ...(overTasks.length ? [{ label: 'Tasks', color: C_COLOR.o, rows: overTasks.map((t) => ({ id: t.id, title: `${t.title} · ${t.clientName}`, meta: `Ended ${dShort(t.due, today)} · ${t.hint}`, state: late(-t.days), color: C_COLOR.o, onOpen: () => onTask(t.taskId) })) }] : []),
                ]}
                link={over.length ? { text: 'Open filings', onClick: () => go(filingsHref.replace(/cadence=monthly&period=[^&]+&/, '') + '&status=overdue') } : undefined}
              />,
              { cls: 'mx-wide' },
            )
          }
        >
          <Icon name="alert" />
          <div>
            <b>{first.title}</b>
            {`${late(first.days)}${nOver > 1 ? ` · ${nOver - 1} more overdue` : ''}`}
          </div>
        </button>
      ) : null}
    </Panel>
  );
}

function MixPanel({
  d,
  rows,
  tasks,
  month,
  onOpen,
  onTask,
  filingsHref,
  cat,
}: {
  d: BookData;
  rows: CRow[];
  /** C-4: the month's tasks join the donut (a done task counts as filed) */
  tasks: TRow[];
  month: string;
  onOpen: (r: CRow) => void;
  onTask: (taskId: string) => void;
  filingsHref: string;
  cat: Category;
}) {
  const { openPop, go } = useConsole();
  const today = d.book.today;
  const n = countSt([...rows, ...tasks]);
  const parts = C_ORDER.map((s) => ({ n: n[s], color: C_COLOR[s], label: C_LABEL[s] }));
  const dr = (list: CRow[], tl: TRow[]) => [
    ...list.map((r) => ({ id: r.id, title: `${r.name} · ${r.clientName}`, meta: whenText(r, today), state: C_LABEL[r.st], color: C_COLOR[r.st], onOpen: () => onOpen(r) })),
    ...tl.map((t) => ({ id: t.id, title: `${t.title} · ${t.clientName}`, meta: `Task · ${t.hint} · ends ${dShort(t.due, today)}`, state: t.word, color: WORD_COLOR[t.word], onOpen: () => onTask(t.taskId) })),
  ];
  const all = rows.length + tasks.length;
  const drill = (i: number, el: Element | null) =>
    openPop(
      el,
      <Drill
        title={`${showStat(cat) ? (showTasks(cat) ? 'Filings and tasks' : 'Filings') : 'Tasks'} · ${monthLong(month)}`}
        sub={`${plural(all, 'item')} across ${plural(new Set([...rows.map((r) => r.clientId), ...tasks.map((t) => t.clientId)]).size, 'client')}`}
        active={i + 1}
        tabs={[{ label: 'All', rows: dr(rows, tasks) }, ...C_ORDER.map((s) => ({ label: C_LABEL[s], color: C_COLOR[s], rows: dr(rows.filter((r) => r.st === s), tasks.filter((t) => t.st === s)) }))]}
        link={showStat(cat) ? { text: 'Open this month’s filings', onClick: () => go(filingsHref) } : undefined}
      />,
      { cls: 'mx-wide' },
    );
  return (
    <Panel
      title={monthLong(month)}
      sub={
        d.loading
          ? 'Loading…'
          : [showStat(cat) ? plural(rows.filter((r) => !r.cal).length, 'filing') : '', n.c ? `${n.c} on SBC calendar` : '', showTasks(cat) ? plural(tasks.length, 'task') : ''].filter(Boolean).join(' · ')
      }
      act={
        <button type="button" className="link" onClick={() => go(filingsHref)}>
          This month’s filings
          <Icon name="chev" size={16} />
        </button>
      }
    >
      <div className="mx-ts">
        <Donut parts={parts} size={108} onPick={(i, el) => drill(i, el)} center={[n.f + n.l, showStat(cat) ? (showTasks(cat) ? 'filed · done' : 'filed') : 'done']} />
        <Legend parts={parts} onPick={(i) => drill(i, null)} />
      </div>
    </Panel>
  );
}

/* ================================================================ SBC: next + urgent, month mix */

const S_ORDER: Array<'o' | 'd' | 'u'> = ['o', 'd', 'u'];

function SbcNextPanel({ loading, rows, today, onOpen }: { loading: boolean; rows: SRow[]; today: string; onOpen: (s: SRow, el: Element | null) => void }) {
  const next = rows.find((s) => s.due >= today);
  const urgent = rows.filter((s) => s.days <= 6 && s.days >= -30).slice(0, 5);
  return (
    <Panel title="Next on SBC’s calendar" sub={next ? dDay(next.due, today) : undefined}>
      {loading ? (
        <div className="sec-load">Loading…</div>
      ) : next ? (
        <div className="mx-nd">
          <div className="mx-ndh">
            <b className="mx-ndn">{next.days === 0 ? 'Today' : plural(next.days, 'day')}</b>
            <span className="mx-dt">
              <b className="cf-ell" title={next.title}>
                {next.name}
              </b>
              <span className="cf-ell">{[next.actFull, next.period].filter(Boolean).join(' · ')}</span>
            </span>
            <button type="button" className="ib sm" aria-label="About this deadline" title="About this deadline" onClick={(e) => onOpen(next, e.currentTarget)}>
              <Icon name="help" />
            </button>
          </div>
          {urgent.length ? (
            <div className="mx-drows">
              <span className="eyebrow">Urgent · passed in the last 30 days or due this week</span>
              {urgent.map((s) => (
                <button key={s.id} type="button" className="mx-drow" onClick={(e) => onOpen(s, e.currentTarget)}>
                  <i style={{ background: C_COLOR[s.st] }} />
                  <span className="mx-dt">
                    <b className="cf-ell">{s.name}</b>
                    <span>{`${s.tag} · ${dShort(s.due, today)}`}</span>
                  </span>
                  <span className="mx-ds">{C_LABEL[s.st]}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <Empty title="Nothing ahead on SBC’s calendar" sub="Its deadlines run to 31 March 2027 for the filters set." />
      )}
    </Panel>
  );
}

function SbcMixPanel({ rows, month, onOpen }: { rows: SRow[]; month: string; onOpen: (s: SRow) => void }) {
  const { openPop } = useConsole();
  const parts = S_ORDER.map((s) => ({ n: rows.filter((r) => r.st === s).length, color: C_COLOR[s], label: C_LABEL[s] }));
  const dr = (list: SRow[]) => list.map((s) => ({ id: s.id, title: s.name, meta: `${s.tag} · ${fmtL(s.due)}`, state: C_LABEL[s.st], color: C_COLOR[s.st], onOpen: () => onOpen(s) }));
  const drill = (i: number, el: Element | null) =>
    openPop(el, <Drill title={`SBC calendar · ${monthLong(month)}`} sub={plural(rows.length, 'deadline')} active={i + 1} tabs={[{ label: 'All', rows: dr(rows) }, ...S_ORDER.map((s) => ({ label: C_LABEL[s], color: C_COLOR[s], rows: dr(rows.filter((r) => r.st === s)) }))]} />, { cls: 'mx-wide' });
  return (
    <Panel title={monthLong(month)} sub={`${plural(rows.length, 'deadline')} on SBC’s calendar`}>
      <div className="mx-ts">
        <Donut parts={parts} size={108} onPick={(i, el) => drill(i, el)} center={[rows.length, 'deadlines']} />
        <Legend parts={parts} onPick={(i) => drill(i, null)} />
      </div>
    </Panel>
  );
}

/* ================================================================ day pop-overs (as the sidebar mini calendar's) */

interface DayPopProps {
  day: string;
  fy: number;
  company: string;
  area: AreaFilter;
  /** statutory rows on (the switch is All or Statutory) */
  stat: boolean;
  /** C-3: the day's non-statutory tasks (ending on it) */
  tasks: TRow[];
  onOpen: (it: CalItem, el: Element | null) => void;
}

function DayPop(props: DayPopProps) {
  const { seat } = useConsole();
  return seat === 'mgr' ? <DayPopMgr {...props} /> : <DayPopBody {...props} extra={[]} />;
}

interface Extra {
  id: string;
  title: string;
  sub: string;
  state: string;
  color: string;
  open: () => void;
  lane: 'step' | 'task';
}

/** Manager seat: the day's step deadlines and team tasks too, from Today's model (what the mini calendar shows). */
function DayPopMgr(props: DayPopProps) {
  const { model: m } = useToday();
  const { go, base, closePop, openDrawer } = useConsole();
  const extra: Extra[] = datedItems(m, props.day, props.day)
    .filter((w) => w.lane !== 'filing' && (props.company === 'all' || w.clientId === props.company))
    .map((w) => {
      const c = m.byId[w.clientId];
      const t = w.ref.kind === 'task' ? m.team.find((x) => x.taskId === w.ref.taskId) : undefined;
      return {
        id: w.id,
        lane: w.lane === 'task' ? 'task' : 'step',
        title: w.title.split(' · ')[0] ?? w.title,
        sub: c?.name ?? '',
        state: w.lane === 'task' ? t?.leadName ?? 'Team task' : w.day < m.today ? 'Overdue' : 'Step deadline',
        color: w.lane === 'task' ? (t ? T_COLOR[t.st] : T_COLOR.none) : w.day < m.today ? T_COLOR.over : T_COLOR.due,
        open: () => {
          closePop();
          if (w.ref.kind === 'task' && w.ref.taskId) openDrawer(<TeamItemDrawer itemId={`t:${w.ref.taskId}`} />);
          else if (w.ref.stepId && c) go(adminProjectStepPath(c.e, w.ref.stepId, base as '/app/manager'));
        },
      };
    });
  return <DayPopBody {...props} extra={extra} />;
}

function DayPopBody({ day, fy, company, area, stat, tasks: trows, onOpen, extra }: DayPopProps & { extra: Extra[] }) {
  const { book } = useBook(fy);
  const rows = stat ? filterRows(book.rows, { company, area }).filter((r) => r.due === day) : [];
  const steps = extra.filter((x) => x.lane === 'step').length;
  const tasks = extra.length - steps;
  return (
    <div>
      <PopHead
        title={fmtL(day)}
        sub={[stat || !trows.length ? plural(rows.length, 'filing') : '', trows.length ? plural(trows.length, 'task') : '', steps ? plural(steps, 'step deadline') : '', tasks ? plural(tasks, 'team task') : ''].filter(Boolean).join(' · ')}
      />
      <div className="mx-drows">
        {trows.map((t) => (
          <button key={t.id} type="button" className="mx-drow" title={`${t.hint} · open the task`} onClick={(e) => onOpen(taskItem(t, true), e.currentTarget)}>
            <i className={'cf-tsq' + (t.done ? ' done' : '')} />
            <span className="mx-dt">
              <b className="cf-ell">{t.title}</b>
              <span>{`${t.clientName} · Task · ${t.hint}`}</span>
            </span>
            <span className="mx-ds">{t.word}</span>
          </button>
        ))}
        {rows.map((r) => (
          <button key={r.id} type="button" className="mx-drow" onClick={(e) => onOpen(rowItem(r, true), e.currentTarget)}>
            <i style={{ background: C_COLOR[r.st] }} />
            <span className="mx-dt">
              <b className="cf-ell">{[r.name, r.period].filter(Boolean).join(' · ')}</b>
              <span>{`${r.clientName} · ${AREA_LABEL[r.area]}`}</span>
            </span>
            <span className="mx-ds">{C_LABEL[r.st]}</span>
          </button>
        ))}
        {extra.map((x) => (
          <button key={x.id} type="button" className="mx-drow" onClick={x.open}>
            <i style={{ background: x.color }} />
            <span className="mx-dt">
              <b className="cf-ell">{x.title}</b>
              <span>{x.sub}</span>
            </span>
            <span className="mx-ds">{x.state}</span>
          </button>
        ))}
        {!rows.length && !trows.length && !extra.length ? <Empty title="A clear day" sub="No filings, tasks, step deadlines or team tasks fall on it." /> : null}
      </div>
    </div>
  );
}

function SbcDayPop({ day, rows, onOpen }: { day: string; rows: SRow[]; onOpen: (s: SRow, el: Element | null) => void }) {
  return (
    <div>
      <PopHead title={fmtL(day)} sub={`${plural(rows.length, 'deadline')} on SBC’s calendar`} />
      <div className="mx-drows">
        {rows.map((s) => (
          <button key={s.id} type="button" className="mx-drow" onClick={(e) => onOpen(s, e.currentTarget)}>
            <i style={{ background: C_COLOR[s.st as CSt] }} />
            <span className="mx-dt">
              <b className="cf-ell" title={s.title}>
                {s.name}
              </b>
              <span>{[s.actFull, s.period].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="mx-ds">{C_LABEL[s.st]}</span>
          </button>
        ))}
        {!rows.length ? <Empty title="No deadline on this day" sub="Nothing on SBC’s calendar for these filters." /> : null}
      </div>
    </div>
  );
}

