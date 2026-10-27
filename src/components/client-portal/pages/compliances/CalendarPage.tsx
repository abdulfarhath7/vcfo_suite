'use client';

/**
 * Compliances · Calendar — prototype s/comp/index.html #cal-redesign (desktop /
 * tablet) with cal-views.js (Month · Year · Timeline, month/year picker) and
 * #cal-mobile under 700 px (CalendarMobile). Real data: /api/client/compliances.
 *
 * URL state: ?date=YYYY-MM · ?view=month|year|timeline · ?area=all|mca|gst|it|pay|fema
 * · ?filing=<id> (the detail pop-up).
 */
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { usePortal } from '../../PortalProvider';
import { BotSays, InfoPopover } from '../../shared';
import { portalHref } from '../../routes';
import {
  AREAS,
  AREA_LABEL,
  MONTHS,
  byDate,
  comingUp,
  daysBetween,
  dow,
  tileSub,
  filterArea,
  fmtDM,
  fmtLong,
  fmtLongComma,
  fmtWDM,
  fyLabelOf,
  fyMonths,
  fyStartOfMonth,
  mondayMonthGrid,
  monthLabel,
  nextDeadline,
  overdueRows,
  plural,
  portalFor,
  sortByDue,
  statusOf,
  stepMonth,
  tileInk,
  tileVar,
  todayIso,
  worstStatus,
  type AreaFilter,
  type PortalFiling,
} from '@/lib/client-portal/compliances';
import { useCompFilings } from './api';
import { AreaChip, Chip, I, NameWithLinks, PortalBtn, ProofChip, Seg, usePageTips } from './bits';
import { CompProvider, useComp } from './ctx';
import { DetailModal } from './Detail';
import { DonutCard } from './DonutCard';
import { MonthNav } from './MonthNav';
import { TimelineView } from './TimelineView';
import { YearView } from './YearView';
import { CalendarMobile } from './CalendarMobile';
import '../../css/compliances-board.css';

const VIEWS = ['month', 'year', 'timeline'] as const;
type View = (typeof VIEWS)[number];
const AREA_IDS = AREAS.map((a) => a.id);
const TIP_KEY = 'vcfo.comp.tip.v1';

function useNarrow(px = 700): boolean {
  const [n, setN] = useState(false);
  useEffect(() => {
    const on = () => setN(window.innerWidth < px);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [px]);
  return n;
}

export function useCalendarState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = todayIso();
  const nowKey = today.slice(0, 7);
  const dateP = params.get('date');
  const month = dateP && /^\d{4}-(0[1-9]|1[0-2])$/.test(dateP.slice(0, 7)) ? dateP.slice(0, 7) : nowKey;
  const viewP = params.get('view');
  const view: View = (VIEWS as readonly string[]).includes(viewP ?? '') ? (viewP as View) : 'month';
  const areaP = (params.get('area') ?? 'all').toUpperCase();
  const area: AreaFilter = areaP === 'ALL' ? 'all' : AREA_IDS.includes(areaP as AreaFilter) ? (areaP as AreaFilter) : 'all';
  const filing = params.get('filing') ?? params.get('open');
  const set = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'filing') next.delete('open');
        if (v == null || v === '' || (k === 'view' && v === 'month') || (k === 'area' && v === 'all') || (k === 'date' && v === nowKey)) next.delete(k);
        else next.set(k, k === 'area' ? v.toLowerCase() : v);
      }
      const q = next.toString();
      router.replace(`${pathname}${q ? `?${q}` : ''}`, { scroll: false });
    },
    [params, router, pathname, nowKey],
  );
  return { today, nowKey, month, view, area, filing, set };
}

export function CompliancesCalendar() {
  const narrow = useNarrow(700);
  const st = useCalendarState();
  const { go } = usePortal();
  const openInFilings = useCallback(
    (f: PortalFiling) => go(`${portalHref('filings')}?fy=${fyStartOfMonth(f.dueDate.slice(0, 7))}&filing=${f.id}`),
    [go],
  );
  return (
    <div className="cp-compliances">
      <CompProvider
        today={st.today}
        onDrillRow={openInFilings}
        drillLink={{ text: 'Open Filings →', onClick: () => go(`${portalHref('filings')}?fy=${fyStartOfMonth(st.month)}`) }}
      >
        {narrow ? <CalendarMobile state={st} onOpenFilings={openInFilings} /> : <CalendarDesktop st={st} onOpenFilings={openInFilings} />}
      </CompProvider>
    </div>
  );
}

/* =================================================================== */

function CalendarDesktop({ st, onOpenFilings }: { st: ReturnType<typeof useCalendarState>; onOpenFilings: (f: PortalFiling) => void }) {
  const { after, go, toast } = usePortal();
  const { today, openDrill } = useComp();
  const { month, view, area, nowKey, set } = st;
  const root = useRef<HTMLDivElement>(null);
  usePageTips(root);

  const fy = fyStartOfMonth(month);
  const todayFy = fyStartOfMonth(nowKey);
  const q = useCompFilings(fy, after);
  const qToday = useCompFilings(todayFy, after);
  const nearFyEnd = Number(nowKey.slice(5)) <= 3;
  const qNext = useCompFilings(todayFy + 1, after && nearFyEnd);

  const fyRows = useMemo(() => (after ? q.data?.rows ?? [] : []), [after, q.data]);
  const railRows = useMemo(
    () => (after ? [...(qToday.data?.rows ?? []), ...(nearFyEnd ? qNext.data?.rows ?? [] : [])] : []),
    [after, qToday.data, qNext.data, nearFyEnd],
  );
  const monthAll = useMemo(() => fyRows.filter((r) => r.dueDate.startsWith(month)), [fyRows, month]);
  const monthRows = useMemo(() => filterArea(monthAll, area), [monthAll, area]);
  const countBase = view === 'month' ? monthAll : fyRows;
  const areaCounts = AREAS.map((a) => (a.id === 'all' ? countBase.length : countBase.filter((r) => r.area === a.id).length));
  const loading = after && (q.isLoading || qToday.isLoading);

  const byId = useMemo(() => {
    const m = new Map<string, PortalFiling>();
    for (const r of [...fyRows, ...railRows]) m.set(r.id, r);
    return m;
  }, [fyRows, railRows]);
  const detail = st.filing ? byId.get(st.filing) ?? null : null;
  const openDetail = (f: PortalFiling) => set({ filing: f.id });

  /* day pop-over */
  const [sel, setSel] = useState<{ iso: string; style: React.CSSProperties; cls: string } | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const closePop = useCallback(() => setSel(null), []);
  useEffect(() => {
    if (!sel) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        const iso = sel.iso;
        setSel(null);
        root.current?.querySelector<HTMLElement>(`.day[data-iso="${iso}"]`)?.focus();
      }
    };
    const down = (e: PointerEvent) => {
      const t = e.target as Element;
      if (popRef.current?.contains(t) || t.closest?.('.day[data-iso]')) return;
      setSel(null);
    };
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', down, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('pointerdown', down, true);
    };
  }, [sel]);
  useEffect(() => setSel(null), [month, view, area]);

  const openDay = (iso: string, cell: HTMLElement) => {
    const ab = root.current!;
    const a = ab.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    const PW = Math.min(320, window.innerWidth - 24);
    const VW = Math.min(a.right, window.innerWidth) - a.left;
    const right = c.right - a.left + 12 + PW <= VW - 12;
    const left = c.left - a.left - PW - 12 >= 12;
    if (right) setSel({ iso, cls: '', style: { left: c.right - a.left + 12, top: c.top - a.top - 8 } });
    else if (left) setSel({ iso, cls: ' flip', style: { left: c.left - a.left - PW - 12, top: c.top - a.top - 8 } });
    else setSel({ iso, cls: ' below', style: { left: Math.max(12, Math.min(VW - PW - 12, c.left - a.left + c.width / 2 - PW / 2)), top: c.bottom - a.top + 8 } });
  };

  /* first-time tip (E-06), per viewer */
  const [tip, setTip] = useState(false);
  useEffect(() => {
    try {
      setTip(!localStorage.getItem(TIP_KEY));
    } catch {
      setTip(false);
    }
  }, []);
  const gotIt = () => {
    setTip(false);
    try {
      localStorage.setItem(TIP_KEY, '1');
    } catch {
      /* private mode */
    }
  };

  const monthName = MONTHS[Number(month.slice(5)) - 1]!;
  const viewIdx = VIEWS.indexOf(view);
  const areaIdx = Math.max(0, AREAS.findIndex((a) => a.id === area));

  /* empty month copy (E-01) */
  const emptyOverlay = (() => {
    if (!after) return { lines: ['Your calendar starts after incorporation.', 'Nothing is due yet.'], showAll: false, q: 'Why is my compliance calendar empty before incorporation?' };
    if (loading || q.isError || view !== 'month' || monthRows.length) return null;
    const pool = sortByDue(filterArea([...fyRows, ...railRows], area)).filter((r) => r.dueDate > `${month}-31`);
    const next = pool[0];
    const head = area === 'all' ? `Nothing is due in ${monthName}.` : `No ${AREA_LABEL[area]} deadlines in ${monthName}.`;
    const tail = next ? `The next one is ${next.name} on ${fmtDM(next.dueDate)}.` : `None due in ${fyLabelOf(fy)}.`;
    return { lines: [head, tail], showAll: area !== 'all', q: `Why is nothing due in ${monthName}?` };
  })();

  return (
    <div className="cp-comp-root page stag" ref={root}>
      {/* header (C-01) */}
      <div className="row-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div data-calnav="" className="calbar">
          <MonthNav month={month} nowKey={nowKey} hidden={view !== 'month'} onMonth={(k) => set({ date: k })} onStep={(k) => set({ date: stepMonth(month, k) })} />
          <span className="mono" style={{ flex: 'none', fontSize: 11, fontWeight: 600, padding: '5px 8px', borderRadius: 5, background: 'var(--gold-soft)', color: 'var(--gold-text)' }} data-tip={`Financial year ${fyLabelOf(fy).slice(3)}`}>
            {fyLabelOf(fy)}
          </span>
          <div className="seg-scroll">
            <Seg
              opts={AREAS.map((a) => a.label)}
              on={areaIdx}
              counts={areaCounts}
              label="Area"
              onPick={(i) => set({ area: AREAS[i]!.id })}
              same={(i) => toast(`Already showing ${AREAS[i]!.label === 'All' ? 'all areas' : AREAS[i]!.label}`)}
            />
          </div>
        </div>
        <div className="end" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span data-calview="" style={{ display: 'contents' }}>
            <Seg
              opts={['Month', 'Year', 'Timeline']}
              on={viewIdx}
              label="Calendar view"
              onPick={(i) => set({ view: VIEWS[i]! })}
              same={(i) => toast(`Already showing the ${['month', 'year', 'timeline'][i]} view`)}
            />
          </span>
          <a
            className="btn btn-o btn-s"
            style={{ color: 'var(--navy-ink,var(--navy))' }}
            href={`${portalHref('filings')}?fy=${fy}`}
            onClick={(e) => {
              e.preventDefault();
              go(`${portalHref('filings')}?fy=${fy}`);
            }}
          >
            {I.file(14)} Filings
          </a>
        </div>
      </div>

      <div className="cal-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {tip && after && view === 'month' ? (
            <div style={{ padding: '2px 2px 0' }}>
              <BotSays
                size={40}
                action=""
                secondary={
                  <button type="button" className="btn btn-o btn-s" style={{ height: 28 }} onClick={gotIt}>
                    Got it
                  </button>
                }
              >
                Tip: click any date to see its filings.
              </BotSays>
            </div>
          ) : null}
          <div className="card t" data-calbody="" data-view={view} style={{ padding: 12, position: 'relative' }}>
            {q.isError && after ? (
              <div role="alert" style={{ padding: '24px 12px', color: 'var(--over-text)', fontWeight: 700 }}>
                Could not load the register.{' '}
                <button type="button" className="btn btn-o btn-s" onClick={() => void q.refetch()}>
                  Try again
                </button>
              </div>
            ) : view === 'month' || !after ? (
              <MonthGrid
                month={month}
                rows={loading ? [] : monthRows}
                today={today}
                selIso={sel?.iso ?? null}
                onDay={(iso, el) => (sel?.iso === iso ? setSel(null) : openDay(iso, el))}
              />
            ) : loading ? (
              <GridSkeleton />
            ) : view === 'year' ? (
              <YearView months={fyMonths(fy)} rows={filterArea(fyRows, area)} today={today} onMonth={(k) => set({ date: k, view: 'month' })} />
            ) : (
              <TimelineView fyStart={fy} rows={filterArea(fyRows, area)} today={today} onOpen={openDetail} />
            )}
            {emptyOverlay ? (
              <div
                style={{
                  position: 'absolute',
                  inset: '44px 14px 14px',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'light-dark(oklch(97.4% 0.006 255 / .7), oklch(16.9% 0.006 255 / 0.7))',
                  borderRadius: 10,
                  backdropFilter: 'blur(1px)',
                }}
              >
                <BotSays
                  size={56}
                  question={emptyOverlay.q}
                  secondary={
                    emptyOverlay.showAll ? (
                      <button type="button" className="btn btn-n btn-s" style={{ height: 28 }} onClick={() => set({ area: 'all' })}>
                        Show all areas
                      </button>
                    ) : undefined
                  }
                >
                  {emptyOverlay.lines[0]}
                  <br />
                  {emptyOverlay.lines[1]}
                </BotSays>
              </div>
            ) : null}
            {loading && view === 'month' ? (
              <div aria-busy="true" aria-label="Loading calendar" style={{ position: 'absolute', inset: '44px 14px 14px', display: 'grid', placeItems: 'center' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Loading…
                </span>
              </div>
            ) : null}
          </div>
        </div>
        <Rail
          after={after}
          loading={loading}
          monthAll={monthAll}
          month={month}
          railRows={railRows}
          nowKey={nowKey}
          onOpen={openDetail}
          openDrill={openDrill}
        />
      </div>

      {sel ? (
        <DayPopover
          ref={popRef}
          iso={sel.iso}
          cls={sel.cls}
          style={sel.style}
          rows={byDate(monthRows).get(sel.iso) ?? []}
          onClose={closePop}
          onOpen={(f) => {
            setSel(null);
            openDetail(f);
          }}
        />
      ) : null}
      {detail ? <DetailModal f={detail} onClose={() => set({ filing: null })} onOpenFilings={onOpenFilings} /> : null}
    </div>
  );
}

/* ------------------------------------------------------- month grid */

function MonthGrid({ month, rows, today, selIso, onDay }: { month: string; rows: PortalFiling[]; today: string; selIso: string | null; onDay: (iso: string, el: HTMLElement) => void }) {
  const dates = byDate(rows);
  const cells = mondayMonthGrid(month);
  return (
    <div className="cal-scroll">
      <div className="cal" role="grid" aria-label={`${monthLabel(month)} filings`}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
          <div key={d} className={`dow${i > 4 ? ' we' : ''}`} role="columnheader">
            {d}
          </div>
        ))}
        {cells.map((c, idx) => {
          if (c.out)
            return (
              <div key={c.iso} className="day out" aria-hidden="true">
                <div className="dn">
                  <span className="dt">{c.day}</span>
                </div>
              </div>
            );
          const it = sortByDue(dates.get(c.iso) ?? []);
          const s = it.length ? worstStatus(it, today) : '';
          const isToday = c.iso === today;
          const we = idx % 7 > 4;
          return (
            <button
              key={c.iso}
              type="button"
              className={`day${we ? ' we' : ''}${s ? ` s-${s}` : ''}${isToday ? ' today' : ''}${selIso === c.iso ? ' sel' : ''}`}
              data-iso={c.iso}
              data-tip={it.length ? `${fmtWDM(c.iso)} · ${plural(it.length, 'filing')}` : undefined}
              aria-label={`${fmtLongComma(c.iso)}, ${plural(it.length, 'filing')}${isToday ? ', today' : ''}`}
              aria-current={isToday ? 'date' : undefined}
              aria-expanded={selIso === c.iso}
              data-notip=""
              onClick={(e) => onDay(c.iso, e.currentTarget)}
            >
              <div className="dn">
                <span className="dt">{c.day}</span>
                {isToday ? (
                  <span className="tlabel">
                    <span className="pulse" />
                    <span className="tl-t">Today</span>
                  </span>
                ) : null}
                {it.length > 1 ? (
                  <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
                    {it.length}
                  </span>
                ) : null}
              </div>
              {it.slice(0, 2).map((r) => {
                const rs = statusOf(r, today);
                return (
                  <span key={r.id} className="ev" data-s={rs}>
                    <i style={{ background: `var(${rs === 'ok' ? '--ok' : rs === 'due' ? '--due' : rs === 'over' ? '--over' : '--up'})` }} />
                    <span className="a">{r.area}</span>
                    <span className="t">{r.name}</span>
                  </span>
                );
              })}
              {it.length > 2 ? <span className="more">+{it.length - 2} more</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,196px),1fr))', gap: 12 }}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="sk-row" style={{ height: 170, borderRadius: 8 }} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------- day pop-over */


const DayPopover = forwardRef<
  HTMLDivElement,
  { iso: string; cls: string; style: React.CSSProperties; rows: PortalFiling[]; onClose: () => void; onOpen: (f: PortalFiling) => void }
>(function DayPopover({ iso, cls, style, rows, onClose, onOpen }, ref) {
  const { today, openProof } = useComp();
  const { openChat } = usePortal();
  const list = sortByDue(rows);
  const s = list.length ? worstStatus(list, today) : 'up';
  const d = Number(iso.slice(8));
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeBtn.current?.focus({ preventScroll: true });
  }, [iso]);
  return (
    <div className={`dpop${cls}`} ref={ref} style={style} role="dialog" aria-label={fmtLong(iso)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div className="dtile" style={{ background: tileVar(s), color: tileInk(s), width: 40, height: 44 }}>
          <b style={{ fontSize: 16 }}>{d}</b>
          <small>{dow(iso)}</small>
        </div>
        <div style={{ flex: 1 }}>
          <b style={{ fontSize: 14 }}>{fmtLong(iso)}</b>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700 }}>{list.length ? plural(list.length, 'filing') : 'Free day'}</div>
        </div>
        <button ref={closeBtn} type="button" className="ibtn" style={{ border: 0 }} aria-label="Close" onClick={onClose}>
          {I.x(14)}
        </button>
      </div>
      {list.length ? (
        <>
          {list.map((r) => (
            <div
              key={r.id}
              className="drow"
              role="button"
              tabIndex={0}
              aria-label={`${r.name} · ${r.period} · open the details`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 6, cursor: 'pointer' }}
              onClick={() => onOpen(r)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen(r);
                }
              }}
            >
              <AreaChip a={r.area} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 12.5 }}>
                  <NameWithLinks f={r} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.period}</div>
              </div>
              <ProofChip f={r} onOpen={(x) => openProof(x)} />
              <Chip s={statusOf(r, today)} />
            </div>
          ))}
          <button
            type="button"
            className="ask"
            style={{ width: '100%', borderLeft: 0, borderRight: 0, borderBottom: 0, background: 'none', padding: '8px 0 0', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}
            onClick={() => {
              onClose();
              openChat(`What is due on ${fmtLong(iso)}?`);
            }}
          >
            🤖 Ask VCFO
          </button>
        </>
      ) : (
        <BotSays size={40} action="">
          Nothing is due on this day.
        </BotSays>
      )}
    </div>
  );
});

/* ------------------------------------------------------------- rail */

function Rail({
  after,
  loading,
  monthAll,
  month,
  railRows,
  nowKey,
  onOpen,
  openDrill,
}: {
  after: boolean;
  loading: boolean;
  monthAll: PortalFiling[];
  month: string;
  railRows: PortalFiling[];
  nowKey: string;
  onOpen: (f: PortalFiling) => void;
  openDrill: ReturnType<typeof useComp>['openDrill'];
}) {
  const { today } = useComp();
  if (!after)
    return (
      <div className="cal-rail" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card" style={{ padding: 14 }}>
          <BotSays size={40} question="When does my compliance calendar start?">
            Your first deadlines appear
            <br />
            once the company is incorporated.
          </BotSays>
        </div>
      </div>
    );
  if (loading)
    return (
      <div className="cal-rail" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <RailSkeleton />
      </div>
    );
  const next = nextDeadline(railRows, today);
  const over = overdueRows(railRows, today);
  const todayMonthRows = railRows.filter((r) => r.dueDate.startsWith(nowKey));
  const allClear = !next && !over.length;
  return (
    <div className="cal-rail" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {monthAll.length ? <DonutCard rows={monthAll} label={MONTHS[Number(month.slice(5)) - 1]!} drillTitle={`Compliances · ${monthLabel(month)}`} /> : null}
      {allClear ? (
        <div className="card" style={{ padding: 14 }}>
          <BotSays size={40} action="">
            All clear this month.
            <br />
            Nothing due, nothing overdue.
          </BotSays>
        </div>
      ) : (
        <NextDeadlineCard next={next} over={over} todayMonthRows={todayMonthRows} railRows={railRows} onOpen={onOpen} openDrill={openDrill} nowKey={nowKey} />
      )}
      <ComingUp rows={comingUp(railRows, today, 7)} onOpen={onOpen} />
    </div>
  );
}

function RailSkeleton() {
  return (
    <div className="card" style={{ padding: '14px 16px' }} aria-busy="true" aria-label="Loading">
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div className="sk-row" style={{ width: 44, height: 48, borderRadius: 8 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
            <div className="sk-row" style={{ height: 10, borderRadius: 4, width: '80%' }} />
            <div className="sk-row" style={{ height: 10, borderRadius: 4, width: '50%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* Next deadline card · option A (C-23) */
function NextDeadlineCard({
  next,
  over,
  todayMonthRows,
  railRows,
  onOpen,
  openDrill,
  nowKey,
}: {
  next: PortalFiling | null;
  over: PortalFiling[];
  todayMonthRows: PortalFiling[];
  railRows: PortalFiling[];
  onOpen: (f: PortalFiling) => void;
  openDrill: ReturnType<typeof useComp>['openDrill'];
  nowKey: string;
}) {
  const { today, remind } = useComp();
  const { toast } = usePortal();
  const days = next ? daysBetween(today, next.dueDate) : 0;
  const firstOver = over[0];
  const fyTitle = `Compliances · ${fyLabelOf(fyStartOfMonth(nowKey))}`;
  return (
    <div className="card nd-card" style={{ background: 'var(--panel)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', padding: '16px 16px 14px', color: 'var(--fg)' }}>
      {next ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: '600 11px var(--font-sans),sans-serif', color: 'var(--navy)' }}>
            <span className="pulse" />
            Next deadline
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 10 }}>
            <div
              data-dd="status"
              data-tip={`${next.name} · due ${fmtWDM(next.dueDate)}`}
              role="button"
              tabIndex={0}
              aria-label={`${plural(days, 'day')} left · ${next.name} · show the list`}
              style={{ width: 58, height: 62, borderRadius: 10, background: 'var(--navy)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
              onClick={() => openDrill({ kind: 'status', k: statusOf(next, today), title: `Compliances · ${monthLabel(nowKey)}`, rows: todayMonthRows.length ? todayMonthRows : railRows })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openDrill({ kind: 'status', k: statusOf(next, today), title: `Compliances · ${monthLabel(nowKey)}`, rows: todayMonthRows.length ? todayMonthRows : railRows });
                }
              }}
            >
              <b className="metric" style={{ fontSize: 28, lineHeight: 1, color: 'inherit' }}>
                {days}
              </b>
              <small style={{ font: '600 11px var(--font-sans),sans-serif', letterSpacing: '.04em', opacity: 0.85 }}>{days === 1 ? 'DAY' : 'DAYS'}</small>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="nd-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, font: "600 18px var(--font-sans)", letterSpacing: '-.02em' }}>
                {next.name} · {next.period} <PortalBtn f={next} />
                <InfoPopover askAbout={`${next.name} · ${next.period}`} label="About this">
                  {next.name} for {next.period} · due {fmtWDM(next.dueDate)} · filed on the {portalFor(next)[0]}.
                  {next.dataReceivedOn ? ` Data received ${fmtDM(next.dataReceivedOn)}.` : ''}
                </InfoPopover>
              </div>
              <div style={{ marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <AreaChip a={next.area} />
                {next.dataReceivedOn ? (
                  <span className="chip c-ok" data-tip={`Data received ${fmtDM(next.dataReceivedOn)}`}>
                    {I.check(11)} Data received
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button type="button" className="btn btn-s" style={{ background: 'var(--navy)', color: '#fff', flex: 1 }} onClick={() => onOpen(next)}>
              Open filing {I.arrow(13)}
            </button>
            <button
              type="button"
              className="btn btn-s"
              style={{ background: 'var(--panel)', color: 'var(--fg)', borderColor: 'var(--border)' }}
              aria-pressed={Boolean(next.reminderOn)}
              onClick={() => (next.reminderOn ? toast(`Reminder already set · email on ${fmtDM(next.reminderOn)}`) : remind(next))}
            >
              {next.reminderOn ? `Reminder ${fmtDM(next.reminderOn)}` : 'Remind me'}
            </button>
          </div>
        </>
      ) : (
        <BotSays size={40} action="">
          Nothing else is due this year.
        </BotSays>
      )}
      {firstOver ? (
        <div
          data-dd="status"
          data-tip={`Overdue · ${over.length}`}
          role="button"
          tabIndex={0}
          aria-label={`Overdue · ${over.length} · show the list`}
          style={{ margin: '14px -16px -14px', padding: '10px 16px', borderTop: '1px solid var(--hair)', borderRadius: '0 0 10px 10px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}
          onClick={() => openDrill({ kind: 'status', k: 'over', title: fyTitle, rows: railRows })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openDrill({ kind: 'status', k: 'over', title: fyTitle, rows: railRows });
            }
          }}
        >
          <i style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--over)', flex: 'none' }} />
          <b style={{ fontWeight: 700 }}>{firstOver.name}</b>
          <span style={{ color: 'var(--over-text)', fontWeight: 700 }}>
            {plural(-daysBetween(today, firstOver.dueDate), 'day')} late{over.length > 1 ? ` · +${over.length - 1} more` : ''}
          </span>
          <span style={{ marginLeft: 'auto', color: 'var(--muted)', display: 'flex' }}>{I.chevR(14)}</span>
        </div>
      ) : null}
    </div>
  );
}

/* Coming up (C-24) */
function ComingUp({ rows, onOpen }: { rows: PortalFiling[]; onOpen: (f: PortalFiling) => void }) {
  const { today } = useComp();
  const dates = [...byDate(rows).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return (
    <div className="card" style={{ padding: '14px 16px 6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <p className="st" style={{ flex: 1 }}>
          Coming up
        </p>
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
          {rows.length}
        </span>
      </div>
      {dates.length ? (
        dates.map(([d, list]) => {
          const s = worstStatus(list, today);
          return (
            <div key={d} className="ag-date">
              <div className="dtile" style={{ background: tileVar(s), color: tileInk(s) }}>
                <b>{Number(d.slice(8))}</b>
                <small>{tileSub(d, today.slice(0, 7))}</small>
              </div>
              <div className="ag-items">
                {list.map((r) => (
                  <div
                    key={r.id}
                    className="ag-it clk"
                    role="button"
                    tabIndex={0}
                    aria-label={`${r.name} · ${r.period} · open the details`}
                    onClick={() => onOpen(r)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpen(r);
                      }
                    }}
                  >
                    <AreaChip a={r.area} />
                    <span className="nm">{r.name}</span>
                    <Chip s={statusOf(r, today)} />
                  </div>
                ))}
              </div>
            </div>
          );
        })
      ) : (
        <div style={{ padding: '6px 0 12px' }}>
          <BotSays size={40} action="">
            Nothing due in the coming weeks.
          </BotSays>
        </div>
      )}
    </div>
  );
}
