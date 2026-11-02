'use client';

/**
 * FILINGS REGISTER — /app/manager/compliances/filings (and the lead seat's
 * /app/intern/compliances/filings). Prototype a59s `mxRenderers.filings`: a
 * status ribbon and area cards that filter, then the period grouped by due
 * date, one row per client and filing, with proof, window and Mark filed.
 *
 * Live functions kept (origin/main FilingsView): the FY stepper (`?fy=`, next
 * stops two years ahead), the company picker (`?company=`), Monthly /
 * Quarterly / Annual (`?cadence=`), the status filter (`?status=` with the
 * live values), the month stepper (`?period=`) and Full year sheet
 * (`?view=year`), the quarterly sheet with due and filed dates, the annual
 * list, the glance counts and Next filing (→ calendar `?date=`), the window
 * control and the proof-and-details editor (managers, admins, super admins
 * only; leads read the window), Open calendar, the pre-incorporation notice
 * and the portfolio note. Added from the prototype on real data: area
 * filter (`?area=`), Mark filed with Undo, Remind me, Export CSV and .ics.
 *
 * Non-statutory tasks (30 Oct 2026, spec rows F-1..F-3): the same All ·
 * Statutory · Non-statutory switch in the head bar (`?cat=`, counts for the
 * window in view). Non-statutory rows are the FY's completed tasks (from
 * `GET /api/compliances/tasks`): the deliverable under the name, "Task" in
 * place of the area tag, no portal link; the proof cell opens the deliverable
 * through its signed link and a row opens the task page. The ribbon and the
 * area cards count the filtered rows; CSV export stays the statutory register.
 * Tasks have no filing cadence: they list by end date in the month sheet and
 * the annual list, and under the quarterly and full-year sheets as a block.
 */
import { Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AREA_LABEL, filingsIcs, fyStartOfMonth, MON, monthLabel as monthLong } from '@/lib/client-portal/compliances';
import { financialYearLabel, financialYearMonths, financialYearQuarters, parseFyParam, parseMonthParam, quarterForMonthKey } from '@/lib/compliance/filings';
import { SecError } from '@/components/portal/ui';
import { useConsole, useConsolePalette, useCrumbs, type PaletteItem } from '../../runtime';
import { Btn, ClientAv, Empty, Icon, Seg } from '../../ui';
import { daysBetween, dDay, dShort, late, plural } from '../today/model';
import { useTodayIso } from '../today/useToday';
import {
  C_COLOR,
  C_LABEL,
  C_ORDER,
  C_SHORT,
  C_TIP,
  CADENCE_LABEL,
  CATEGORY_LABEL,
  areaStats,
  asPortal,
  byDay,
  catCounts,
  catParam,
  countSt,
  filterRows,
  filterTasks,
  isCadence,
  nextDeadline,
  parseArea,
  parseCat,
  parseStatus,
  periodMatrix,
  quarterOf,
  registerCsv,
  showStat,
  showTasks,
  statusParam,
  taskPath,
  whenText,
  winShort,
  worstOf,
  type Cadence,
  type CRow,
  type MxRow,
  type BookClient,
  type StatusFilter,
  type TRow,
  STATUS_FILTER_LABEL,
} from './model';
import { useBook, useComplianceBadges, useFyTasks } from './data';
import { CategorySeg, ComplianceBanners, CompanySelect, DeliverableBtn, FilingPop, LawTag, MonthPick, ProofEditor, ReminderBtn, StPill, TaskMark, WindowPop, WordPill, downloadText, useMarkFiled } from './shared';

type SheetRow = CRow | TRow;
const isTask = (r: SheetRow): r is TRow => 'taskId' in r;

export function FilingsPage() {
  return (
    <Suspense fallback={<div className="glass panel mx-p"><div className="sec-load">Loading the register…</div></div>}>
      <Filings />
    </Suspense>
  );
}

const RIBBON: Array<{ k: Exclude<StatusFilter, 'all'>; label: string; color: string }> = [
  { k: 'f', label: 'Filed', color: 'var(--mx-ok)' },
  { k: 'd', label: 'Due this week', color: C_COLOR.d },
  { k: 'o', label: 'Overdue', color: C_COLOR.o },
  { k: 'u', label: 'Upcoming', color: C_COLOR.u },
  { k: 'c', label: 'SBC calendar', color: C_COLOR.c },
];

function Filings() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const { base, go, openPop } = useConsole();
  const today = useTodayIso();
  useComplianceBadges();

  const currentFy = fyStartOfMonth(today.slice(0, 7));
  const cadenceParam = params.get('cadence');
  const cadence: Cadence = isCadence(cadenceParam) ? cadenceParam : 'monthly';
  const period = parseMonthParam(params.get('period'));
  const fy = parseFyParam(params.get('fy')) ?? (period ? fyStartOfMonth(period) : currentFy);
  const monthKey = period ?? today.slice(0, 7);
  const fullYear = params.get('view') === 'year';
  const status = parseStatus(params.get('status'));
  const area = parseArea(params.get('area'));
  /* F-1: All · Statutory · Non-statutory (`?cat=`) */
  const cat = parseCat(params.get('cat'));

  const data = useBook(fy);
  const { book, mayWrite } = data;
  const td = useFyTasks(fy, book);
  const sole = book.clients.length === 1 ? book.clients[0] : undefined;
  const rawCompany = params.get('company');
  const company = sole ? sole.id : rawCompany && book.byId[rawCompany]?.inScope ? rawCompany : 'all';
  const companyName = company !== 'all' ? book.byId[company]?.short : undefined;
  useCrumbs(companyName ? ['Filings register', companyName] : ['Filings register']);

  useEffect(() => {
    if (data.leadHasNothing) router.replace(`${base}/today`);
  }, [data.leadHasNothing, router, base]);

  const setParams = (next: Record<string, string | null>) => {
    const s = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) s.delete(k);
      else s.set(k, v);
    }
    router.replace(`${pathname}?${s.toString()}`, { scroll: false });
  };

  /* ---------- the rows */
  const base0 = useMemo(() => filterRows(book.rows, { company }), [book.rows, company]);
  /* F-2: the FY's completed tasks of the company in view; an area pick hides them (a task has no regulator) */
  const doneTasks = useMemo(() => filterTasks(td.tasks, { company, done: true }), [td.tasks, company]);
  const taskWindow = useMemo(
    () => (area === 'all' ? filterTasks(doneTasks, { status, month: cadence === 'monthly' && !fullYear ? monthKey : undefined }) : []),
    [doneTasks, area, status, cadence, fullYear, monthKey],
  );
  const taskSheet = useMemo(() => (showTasks(cat) ? taskWindow : []), [taskWindow, cat]);
  /* F-3: the ribbon and the area cards count the filtered rows (a done task counts as filed) */
  const counts = useMemo(() => countSt([...(showStat(cat) ? base0 : []), ...(showTasks(cat) ? doneTasks : [])]), [base0, doneTasks, cat]);
  const areas = useMemo(() => areaStats(showStat(cat) ? base0 : []), [base0, cat]);
  const next = showStat(cat) ? nextDeadline(base0, today) : undefined;
  const listed = useMemo(() => filterRows(base0, { area, status, cadence }), [base0, area, status, cadence]);
  const months = useMemo(() => financialYearMonths(fy), [fy]);
  const monthIndex = months.findIndex((m) => m.key === monthKey);
  const statWindow = cadence === 'monthly' && !fullYear ? listed.filter((r) => r.due.slice(0, 7) === monthKey) : listed;
  /** the statutory rows on screen (CSV and .ics export these) */
  const sheet = showStat(cat) ? statWindow : [];
  const catN = useMemo(() => catCounts(statWindow, taskWindow), [statWindow, taskWindow]);
  const perClient = company === 'all';
  const matrix = useMemo<{ cols: Array<{ key: string; label: string; sub?: string; now: boolean }>; rows: MxRow[] } | null>(() => {
    if (!showStat(cat)) return null;
    if (cadence === 'quarterly') {
      const qs = financialYearQuarters(fy);
      const cur = quarterForMonthKey(today.slice(0, 7), fy)?.key;
      return { cols: qs.map((q) => ({ key: q.key, label: q.label, sub: q.rangeLabel, now: q.key === cur })), rows: periodMatrix(listed, qs.map((q) => q.key), quarterOf(fy), perClient) };
    }
    if (cadence === 'monthly' && fullYear)
      return { cols: months.map((m) => ({ key: m.key, label: m.shortLabel, now: m.key === today.slice(0, 7) })), rows: periodMatrix(listed, months.map((m) => m.key), (r) => r.due.slice(0, 7), perClient) };
    return null;
  }, [cat, cadence, fullYear, fy, months, listed, perClient, today]);
  /** the grouped sheet: statutory rows and done tasks in one date order (a filing before a task on the same day) */
  const grouped = useMemo<SheetRow[]>(() => [...sheet, ...taskSheet].sort((a, b) => a.due.localeCompare(b.due) || Number(isTask(a)) - Number(isTask(b))), [sheet, taskSheet]);
  const openTask = (taskId: string) => go(taskPath(base, taskId));

  /* ---------- search: the FY's register filings */
  const palette = useMemo<PaletteItem[]>(
    () =>
      book.rows
        .filter((r) => !r.cal)
        .slice(0, 300)
        .map((r) => ({
          id: `filing:${r.id}`,
          label: `${r.name}${r.period ? ` · ${r.period}` : ''} · ${book.byId[r.clientId]?.short ?? r.clientName}`,
          kind: `Filing · ${dShort(r.due, today)} · ${C_LABEL[r.st]}`,
          sw: C_COLOR[r.st],
          go: () => go(`${base}/compliances/filings?fy=${book.fy}&cadence=${r.cadence ?? 'annual'}${r.cadence === 'monthly' ? `&period=${r.due.slice(0, 7)}` : ''}&company=${r.clientId}`),
        })),
    [book.rows, book.byId, book.fy, today, go, base],
  );
  useConsolePalette('compliance-filings', palette);

  const companyQ = company !== 'all' && !sole ? `company=${company}` : '';
  const openRow = (r: CRow, el: Element | null) => openPop(el, <FilingPop id={r.id} fy={fy} />, { cls: 'mx-wide' });
  const fileStem = `filings-${financialYearLabel(fy).replace(/\s+/g, '-')}-${cadence}${cadence === 'monthly' && !fullYear ? `-${monthKey}` : ''}`;
  const exportCsv = () => downloadText(`${fileStem}.csv`, '﻿' + registerCsv(sheet), 'text/csv;charset=utf-8');
  const unfiled = sheet.filter((r) => !r.cal && !r.filedOn);
  const exportIcs = () => downloadText(`${fileStem}.ics`, filingsIcs(unfiled.map(asPortal)), 'text/calendar;charset=utf-8');

  const title =
    cadence === 'monthly' ? (fullYear ? `Monthly · ${book.fyLabel}` : monthLong(monthKey)) : `${CADENCE_LABEL[cadence]} · ${book.fyLabel}`;
  const filtersOn = status !== 'all' || area !== 'all';
  const filterWords = [cat !== 'all' ? CATEGORY_LABEL[cat] : '', status !== 'all' ? STATUS_FILTER_LABEL[status] : '', area !== 'all' ? AREA_LABEL[area] : ''].filter(Boolean).join(' · ');
  const rowCount = sheet.length + taskSheet.length;
  const taskBlock = taskSheet.length ? (
    <div className="cf-tblock">
      <span className="eyebrow">{`Non-statutory tasks · done in ${book.fyLabel} · ${plural(taskSheet.length, 'task')}`}</span>
      <Grouped rows={taskSheet} byId={book.byId} today={today} perClient={perClient} mayWrite={mayWrite} enriched={book.enriched} fy={fy} onOpen={openRow} onTask={openTask} onPick={(id) => setParams({ company: id })} />
    </div>
  ) : null;

  return (
    <>
      <div className="sec-h">
        <h2>Filings register</h2>
        <div className="mx-mnav">
          <button type="button" className="ib sm" aria-label="Previous financial year" onClick={() => setParams({ fy: String(fy - 1), period: null })}>
            <Icon name="back" />
          </button>
          <span className="sec-count">{book.fyLabel}</span>
          <button type="button" className="ib sm" aria-label="Next financial year" disabled={fy >= currentFy + 2} onClick={() => setParams({ fy: String(fy + 1), period: null })}>
            <Icon name="chev" />
          </button>
        </div>
        <span className="sp" />
        {book.clients.length > 1 ? <CompanySelect clients={book.clients} value={company} onChange={(v) => setParams({ company: v === 'all' ? null : v })} /> : null}
        <CategorySeg value={cat} counts={td.loading && !td.tasks.length ? { all: '–', statutory: catN.statutory, 'non-statutory': '–' } : catN} onChange={(c) => setParams({ cat: catParam(c) })} />
        <Seg<Cadence>
          className="sm"
          ariaLabel="Filing cadence"
          value={cadence}
          onChange={(v) => setParams({ cadence: v })}
          options={(['monthly', 'quarterly', 'annual'] as Cadence[]).map((c) => ({ value: c, label: CADENCE_LABEL[c] }))}
        />
        <Btn cls="sm" ico="dl" disabled={!sheet.length} title={showTasks(cat) ? 'Download the statutory rows on screen as a CSV file (tasks are not exported)' : 'Download the rows on screen as a CSV file'} onClick={exportCsv}>
          Export
        </Btn>
        <Btn cls="sm" ico="cal" disabled={!unfiled.length} title="Download the unfiled filings on screen as an .ics file for a calendar app" onClick={exportIcs}>
          .ics
        </Btn>
        <Btn cls="sm" ico="cal" onClick={() => go(`${base}/compliances/calendar${companyQ ? `?${companyQ}` : ''}`)}>
          Calendar
        </Btn>
      </div>

      {!data.loading ? <ComplianceBanners book={book} company={company} /> : null}

      <section className="glass mx-fribbon" aria-label={`${book.fyLabel} at a glance, every cadence`}>
        <div className="mx-frbar">
          {RIBBON.filter((s) => s.k !== 'c' || counts.c).map((s) => {
            const n = s.k === 'f' ? counts.f + counts.l : counts[s.k];
            return (
              <button
                key={s.k}
                type="button"
                className={status === s.k ? 'on' : ''}
                aria-pressed={status === s.k}
                style={{ flex: n || 0.3, ['--bc' as string]: s.color }}
                title={`${s.label} · ${n} in ${book.fyLabel}${s.k === 'f' && showTasks(cat) && doneTasks.length ? ` (${plural(doneTasks.length, 'done task')} count as filed)` : ''} · ${status === s.k ? 'click to show every status' : 'click to show only these'}`}
                onClick={() => setParams({ status: status === s.k ? null : statusParam(s.k) })}
              >
                <b>{data.loading ? '–' : n}</b>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mx-frareas">
          {showTasks(cat) ? (
            <button
              type="button"
              className={'mx-fra cf-tcard' + (cat === 'non-statutory' ? ' on' : '')}
              aria-pressed={cat === 'non-statutory'}
              title={`Non-statutory tasks · ${cat === 'non-statutory' ? 'click to show statutory filings too' : 'click to show only tasks'}`}
              onClick={() => setParams({ cat: cat === 'non-statutory' ? null : 'non-statutory' })}
            >
              <TaskMark word={false} />
              <span className="mx-dt">
                <b>Tasks</b>
                <span>{td.loading && !td.tasks.length ? 'Loading…' : td.error ? 'Could not load' : doneTasks.length ? `${plural(doneTasks.length, 'done task')} this year${area !== 'all' ? ' · hidden by the area pick' : ''}` : 'No task done this year'}</span>
              </span>
            </button>
          ) : null}
          {areas.map((a) => (
            <button
              key={a.area}
              type="button"
              className={'mx-fra' + (area === a.area ? ' on' : '')}
              aria-pressed={area === a.area}
              title={`${a.label} · ${area === a.area ? 'click to show every area' : 'click to show only these'}`}
              onClick={() => setParams({ area: area === a.area ? null : a.area })}
            >
              <LawTag area={a.area} tag={a.area} />
              <span className="mx-dt">
                <b>{a.label}</b>
                <span>{a.register ? `${a.filed} of ${a.register} filed` : a.lines ? `${a.lines} on SBC calendar` : 'Nothing this year'}</span>
              </span>
              <span className="mx-frm">
                <i style={{ width: `${a.register ? (a.filed / a.register) * 100 : 0}%` }} />
              </span>
            </button>
          ))}
          {next ? (
            <button
              type="button"
              className="mx-fra cf-next"
              title="Open the calendar on this day"
              onClick={() => go(`${base}/compliances/calendar?date=${next.due}${companyQ ? `&${companyQ}` : ''}`)}
            >
              <Icon name="clock" size={16} />
              <span className="mx-dt">
                <b className="cf-ell" title={`${next.name} · ${next.clientName}`}>{`Next · ${next.name}`}</b>
                <span className="cf-ell">{`${perClient ? `${book.byId[next.clientId]?.short ?? next.clientName} · ` : ''}${dDay(next.due, today)}`}</span>
              </span>
            </button>
          ) : null}
          {filtersOn || cat !== 'all' ? (
            <button type="button" className="link" onClick={() => setParams({ status: null, area: null, cat: null })}>
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      <section className="glass panel mx-p">
        <div className="ph">
          <div className="mx-pt">
            <h3>{title}</h3>
            <span className="small">
              {data.loading
                ? 'Loading…'
                : `${plural(rowCount, 'row')}${filterWords ? ` · ${filterWords}` : ''}${matrix ? ' · click a cell for the filing' : ' · grouped by due date'}${matrix && taskSheet.length ? ' · tasks below' : ''}`}
            </span>
          </div>
          <span className="sp" />
          {cadence === 'monthly' ? (
            <>
              {!fullYear ? (
                <div className="mx-mnav">
                  <button type="button" className="ib sm" aria-label="Previous month" disabled={monthIndex <= 0} onClick={() => setParams({ period: months[monthIndex - 1]!.key, fy: String(fy) })}>
                    <Icon name="back" />
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    aria-label="Pick a month"
                    onClick={(e) => openPop(e.currentTarget, <MonthPick value={monthKey} onPick={(k) => setParams({ period: k, fy: String(fyStartOfMonth(k)) })} />, { cls: 'mx-narrow' })}
                  >
                    {monthLong(monthKey)}
                    <Icon name="down" size={12} />
                  </button>
                  <button
                    type="button"
                    className="ib sm"
                    aria-label="Next month"
                    disabled={monthIndex < 0 || monthIndex >= months.length - 1}
                    onClick={() => setParams({ period: months[monthIndex + 1]!.key, fy: String(fy) })}
                  >
                    <Icon name="chev" />
                  </button>
                </div>
              ) : null}
              <Seg<'month' | 'year'>
                className="sm"
                ariaLabel="Month or the full year"
                value={fullYear ? 'year' : 'month'}
                onChange={(v) => setParams({ view: v === 'year' ? 'year' : null })}
                options={[
                  { value: 'month', label: 'This month' },
                  { value: 'year', label: 'Full year' },
                ]}
              />
            </>
          ) : null}
        </div>

        {data.loading ? (
          <div className="sec-load">Loading the register…</div>
        ) : data.error ? (
          <SecError message="Could not load the register. Please try again in a moment." onRetry={data.retry} />
        ) : matrix ? (
          <>
            {matrix.rows.length ? (
              <Matrix cols={matrix.cols} rows={matrix.rows} today={today} quarterly={cadence === 'quarterly'} onOpen={openRow} />
            ) : (
              <Empty title={`No ${CADENCE_LABEL[cadence].toLowerCase()} filings in ${book.fyLabel}${filterWords ? ' for these filters' : ''}`} sub="The register fills in as each registration goes live." />
            )}
            {taskBlock}
          </>
        ) : grouped.length ? (
          <Grouped rows={grouped} byId={book.byId} today={today} perClient={perClient} mayWrite={mayWrite} enriched={book.enriched} fy={fy} onOpen={openRow} onTask={openTask} onPick={(id) => setParams({ company: id })} />
        ) : (
          <Empty
            title={
              showStat(cat)
                ? `No ${showTasks(cat) ? 'filings or done tasks' : 'filings'} recorded for ${cadence === 'monthly' && !fullYear ? monthLong(monthKey) : book.fyLabel}${filterWords ? ' with these filters' : ''}`
                : `No task done ${cadence === 'monthly' && !fullYear ? `in ${monthLong(monthKey)}` : `in ${book.fyLabel}`}${filterWords ? ' with these filters' : ''}`
            }
            sub={
              showStat(cat) && listed.length && cadence === 'monthly'
                ? `${plural(listed.length, 'row')} match in other months · switch to Full year to see them.`
                : showStat(cat)
                  ? 'The register fills in as each registration goes live.'
                  : area !== 'all'
                    ? 'Tasks have no regulator, so an area pick hides them. Clear the area to see them.'
                    : 'A task appears here once it is marked completed on its task page.'
            }
          />
        )}
        {showTasks(cat) && td.error ? (
          <p className="small cf-note" role="status">
            The non-statutory tasks could not load.{' '}
            <button type="button" className="link" onClick={td.retry}>
              Try again
            </button>
          </p>
        ) : null}
        <div className="mx-phleg cf-leg" aria-label="What the marks mean">
          {C_ORDER.map((s) => (
            <span key={s} title={C_TIP[s]}>
              <i className="cf-sw" style={{ background: C_COLOR[s] }} />
              {C_LABEL[s]}
            </span>
          ))}
          <span title="The working window the manager set for the filing">
            <Icon name="cal" size={12} />
            Window
          </span>
          {showTasks(cat) ? (
            <span title="A non-statutory task completed this year, listed on its end date; its proof is the deliverable file. Click the row to open the task.">
              <i className="cf-tsq done" />
              Task · done
            </span>
          ) : null}
        </div>
      </section>
    </>
  );
}

/* ================================================================ grouped by due date (prototype) */

function Grouped({
  rows,
  byId,
  today,
  perClient,
  mayWrite,
  enriched,
  fy,
  onOpen,
  onTask,
  onPick,
}: {
  /** register rows and done tasks (F-2), already in one date order */
  rows: SheetRow[];
  byId: Record<string, BookClient>;
  today: string;
  perClient: boolean;
  mayWrite: boolean;
  enriched: boolean;
  fy: number;
  onOpen: (r: CRow, el: Element | null) => void;
  onTask: (taskId: string) => void;
  onPick: (clientId: string) => void;
}) {
  const days = [...byDay(rows).entries()];
  return (
    <div>
      {days.map(([d, list]) => {
        const w = worstOf(list.map((r) => r.st)) ?? 'u';
        const nTasks = list.filter(isTask).length;
        return (
          <div key={d} className="mx-fgrp">
            <div className={'mx-fgh2 s-' + w}>
              <span className={'mx-dtile' + (w === 'o' ? ' red' : '')} aria-hidden="true">
                <b>{Number(d.slice(8, 10))}</b>
                <small>{MON[Number(d.slice(5, 7)) - 1]}</small>
              </span>
              <b>{`${dDay(d, today)}${d === today ? ' · today' : ''}`}</b>
              <span className="small">{[list.length - nTasks ? plural(list.length - nTasks, 'filing') : '', nTasks ? plural(nTasks, 'task') : ''].filter(Boolean).join(' · ')}</span>
            </div>
            {list.map((r) =>
              isTask(r) ? (
                <TaskFRow key={r.id} t={r} c={byId[r.clientId]} today={today} perClient={perClient} onTask={onTask} onPick={onPick} />
              ) : (
                <FRow key={r.id} r={r} c={byId[r.clientId]} today={today} perClient={perClient} mayWrite={mayWrite} enriched={enriched} fy={fy} onOpen={onOpen} onPick={onPick} />
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The client cell both row kinds share: a door to that client's rows on all companies, plain otherwise. */
function ClientCell({ id, name, c, perClient, onPick }: { id: string; name: string; c?: BookClient; perClient: boolean; onPick: (clientId: string) => void }) {
  const inner = (
    <>
      <ClientAv id={id} label={c?.initials ?? name.slice(0, 2).toUpperCase()} />
      <span>
        <b className="cf-ell">{c?.short ?? name}</b>
        <span className="small cf-ell">{c?.leadName ? `Lead ${c.leadName.split(/\s+/)[0]}` : 'No lead'}</span>
      </span>
    </>
  );
  return perClient ? (
    <button type="button" className="mx-tc3 cf-cli" title={`Show only ${name}`} onClick={() => onPick(id)}>
      {inner}
    </button>
  ) : (
    <span className="mx-tc3">{inner}</span>
  );
}

/**
 * F-2: a completed task as a register row — "Task" in place of the area tag,
 * the deliverable under the name, the start-to-end span where the window sits,
 * Done as its status, the deliverable as its proof, no portal link. The name
 * and the arrow open the task page.
 */
function TaskFRow({ t, c, today, perClient, onTask, onPick }: { t: TRow; c?: BookClient; today: string; perClient: boolean; onTask: (taskId: string) => void; onPick: (clientId: string) => void }) {
  const sub = [t.deliverable ? t.deliverable.fileName : 'No deliverable', t.owner ? `by ${t.owner}` : '', t.hint].filter(Boolean).join(' · ');
  return (
    <div className="mx-frow s-f">
      <ClientCell id={t.clientId} name={t.clientName} c={c} perClient={perClient} onPick={onPick} />
      <span className="mx-tc1">
        <span className="mx-chips">
          <TaskMark done title={`Non-statutory task · ${t.hint}`} />
          <button type="button" className="cf-fn" title={`${t.title} · open the task`} onClick={() => onTask(t.taskId)}>
            <b className="cf-ell">{t.title}</b>
          </button>
        </span>
        <span className="small cf-ell" title={sub}>
          {sub}
        </span>
      </span>
      <span className="cf-fd">
        <span className="small">{`Done ${dShort(t.completedOn ?? t.due, today)}`}</span>
        <span className="cf-win ro cf-tspan" title="The task ran from its start date to its end date">
          <Icon name="cal" size={12} />
          {winShort({ from: t.start, to: t.due }, today)}
        </span>
      </span>
      <span className="cf-st">
        <WordPill word={t.word} />
      </span>
      <span className="mx-moves">
        <DeliverableBtn t={t} />
        <button type="button" className="ib sm" aria-label={`Open the task · ${t.title}`} title="Open the task" onClick={() => onTask(t.taskId)}>
          <Icon name="chev" />
        </button>
      </span>
    </div>
  );
}

function FRow({
  r,
  c,
  today,
  perClient,
  mayWrite,
  enriched,
  fy,
  onOpen,
  onPick,
}: {
  r: CRow;
  c?: BookClient;
  today: string;
  perClient: boolean;
  mayWrite: boolean;
  enriched: boolean;
  fy: number;
  onOpen: (r: CRow, el: Element | null) => void;
  onPick: (clientId: string) => void;
}) {
  const { openPop, openModal } = useConsole();
  const markFiled = useMarkFiled();
  let moves: ReactNode;
  if (r.cal) moves = <span className="small" title={C_TIP.c}>Not on the register yet</span>;
  else
    moves = (
      <>
        {r.filedOn ? (
          enriched && r.proofs ? (
            <button type="button" className="pill ok cf-pb" title="Open the filing and its proofs" onClick={(e) => onOpen(r, e.currentTarget)}>
              <Icon name="doc" />
              {r.proofs > 1 ? `Proof · ${r.proofs}` : 'Proof'}
            </button>
          ) : enriched ? (
            <span className="small">Proof pending</span>
          ) : null
        ) : mayWrite ? (
          <Btn cls="sm" ico="check" onClick={() => void markFiled(r, today)}>
            Mark filed
          </Btn>
        ) : null}
        {mayWrite ? (
          <button type="button" className="ib sm" aria-label={`Proof and details · ${r.name}`} title="Proof and details" onClick={() => openModal(<ProofEditor id={r.id} fy={fy} />, { label: 'Proof and details' })}>
            <Icon name="up" />
          </button>
        ) : null}
        <ReminderBtn r={r} small />
      </>
    );
  const sub = [r.period, r.freqLabel, r.authorityName].filter(Boolean).join(' · ');
  return (
    <div className={'mx-frow s-' + r.st}>
      <ClientCell id={r.clientId} name={r.clientName} c={c} perClient={perClient} onPick={onPick} />
      <span className="mx-tc1">
        <span className="mx-chips">
          <LawTag area={r.area} tag={r.area} />
          <button type="button" className="cf-fn" title={`${r.particular} · open the filing`} onClick={(e) => onOpen(r, e.currentTarget)}>
            <b className="cf-ell">{r.name}</b>
          </button>
        </span>
        <span className="small cf-ell" title={sub}>
          {sub}
        </span>
      </span>
      <span className="cf-fd">
        <span className={'small' + (r.st === 'l' ? ' red' : '')}>
          {r.filedOn ? `Filed ${dShort(r.filedOn, today)}${r.st === 'l' ? ` · ${late(daysBetween(r.due, r.filedOn))}` : ''}` : r.cal ? 'SBC calendar' : 'Not filed yet'}
        </span>
        {r.cal ? null : mayWrite ? (
          <button type="button" className="cf-win" title="Set or clear the working window" onClick={(e) => openPop(e.currentTarget, <WindowPop id={r.id} fy={fy} />)}>
            <Icon name="cal" size={12} />
            {r.window ? winShort(r.window, today) : 'Set window'}
          </button>
        ) : r.window ? (
          <span className="cf-win ro" title="The working window the manager set">
            <Icon name="cal" size={12} />
            {winShort(r.window, today)}
          </span>
        ) : null}
      </span>
      <span className="cf-st">
        <StPill st={r.st} />
        {r.st === 'o' || r.st === 'd' ? <span className={'small' + (r.st === 'o' ? ' red' : '')}>{whenText(r, today)}</span> : null}
      </span>
      <span className="mx-moves">{moves}</span>
    </div>
  );
}

/* ================================================================ period sheets (live Full year / Quarterly) */

function Matrix({
  cols,
  rows,
  today,
  quarterly,
  onOpen,
}: {
  cols: Array<{ key: string; label: string; sub?: string; now: boolean }>;
  rows: MxRow[];
  today: string;
  quarterly: boolean;
  onOpen: (r: CRow, el: Element | null) => void;
}) {
  return (
    <div className="cf-scrollx">
      <div className="cf-mx" style={{ gridTemplateColumns: `minmax(200px, 1.6fr) repeat(${cols.length}, minmax(${quarterly ? 96 : 62}px, 1fr))` }}>
        <span className="cf-mxh">Filing</span>
        {cols.map((c) => (
          <span key={c.key} className={'cf-mxh' + (c.now ? ' now' : '')}>
            {c.label}
            {c.sub ? <small>{c.sub}</small> : null}
          </span>
        ))}
        {rows.map((m) => (
          <MxLine key={m.key} m={m} cols={cols} today={today} quarterly={quarterly} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function MxLine({ m, cols, today, quarterly, onOpen }: { m: MxRow; cols: Array<{ key: string; now: boolean }>; today: string; quarterly: boolean; onOpen: (r: CRow, el: Element | null) => void }) {
  return (
    <>
      <span className="cf-mxn">
        <LawTag area={m.area} tag={m.area} />
        <span className="mx-dt">
          <b className="cf-ell" title={m.name}>
            {m.name}
          </b>
          <span className="cf-ell">{`${m.clientName ? `${m.clientName} · ` : ''}${AREA_LABEL[m.area]}`}</span>
        </span>
      </span>
      {m.cells.map((cell, i) =>
        cell ? (
          <button
            key={cols[i]!.key}
            type="button"
            className={'cf-mc s-' + cell.st + (cols[i]!.now ? ' now' : '')}
            title={`${cell.name} · ${cell.clientName} · due ${dShort(cell.due, today)}${cell.filedOn ? ` · filed ${dShort(cell.filedOn, today)}` : ''} · ${C_LABEL[cell.st]}`}
            onClick={(e) => onOpen(cell, e.currentTarget)}
          >
            <b>{dShort(cell.due, today)}</b>
            <span>{quarterly ? (cell.filedOn ? `Filed ${dShort(cell.filedOn, today)}` : C_SHORT[cell.st]) : C_SHORT[cell.st]}</span>
          </button>
        ) : (
          <span key={cols[i]!.key} className={'cf-mc x' + (cols[i]!.now ? ' now' : '')} title="Nothing due in this period" />
        ),
      )}
    </>
  );
}

