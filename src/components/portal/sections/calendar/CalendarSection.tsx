'use client';

/**
 * Compliance calendar (prototype body.txt CALENDAR + a4_cal.js): a toolbar
 * (month picker, FY, law filter, Month / Year / Timeline), a ribbon of the
 * FY's 12 months, the month grid (or the year wall, or one lane per law over
 * the year) and a rail with the status donut, the next deadline and what is
 * coming up. Every filing comes from /api/client/compliances (useFilings);
 * each chip, dot and row opens the shared filing card (filings/actions.tsx).
 *
 * Also owns: the Calendar nav badge (overdue count), the search items for every
 * filing of the current FY, and the `filing` route intent (old email links).
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { statusOf, fyLabelOf, fyMonths, fyStartOfMonth, type PortalFiling } from '@/lib/client-portal/compliances';
import { byStatus, fyRange, groupsByDay, worstOf } from '@/lib/client-portal/filing-track';
import { useIntent, useNavBadge, usePaletteItems, usePortal, type PaletteItem } from '../../runtime';
import { getJson, useFilings } from '../../data';
import { daysTo, fmt, fmtL, fyOf, iso as isoOf, MON, MONL, P, rel, todayIso } from '../../dates';
import { Btn, DateTile, Icon, LAWS, LawChip, lawVar, Seg, SecError, SecHead, SecLoading, ST_LABEL, type FilingSt, type LawKey } from '../../ui';
import { useFilingActions, useFyFilings, useReminder } from '../filings/actions';
import { Donut, lawShort, statusSegs } from '../filings/charts';
import '../../css/95-filings.css';

type View = 'month' | 'year' | 'timeline';
type Law = LawKey | 'all';


function stepYm(ym: string, k: number): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const t = y * 12 + (m - 1) + k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

export function CalendarSection() {
  const { shell, go, toast } = usePortal();
  const { openFiling, openDay } = useFilingActions();
  const today = todayIso();
  const curFy = fyOf(today).start;

  const [ym, setYmState] = useState(today.slice(0, 7));
  const [view, setView] = useState<View>('month');
  const [law, setLaw] = useState<Law>('all');
  const [status, setStatus] = useState<FilingSt | null>(null);

  const fy = fyStartOfMonth(ym);
  const FYM = useMemo(() => fyMonths(fy), [fy]);
  const q = useFyFilings(`${ym}-01`);
  // the whole register (no fy: every year) — the rail, the badge, search, route intents and the month range
  const cur = useFilings();
  const all = useMemo(() => q.data?.rows ?? [], [q.data]);
  const curRows = useMemo(() => cur.data?.rows ?? [], [cur.data]);
  const span = useMemo(() => fyRange(curRows, curFy), [curRows, curFy]);
  const minYm = `${span.lo}-04`;
  const maxYm = `${span.hi + 1}-03`;
  const setYm = (v: string) => setYmState(v < minYm ? minYm : v > maxYm ? maxYm : v);
  const railRows = useMemo(() => {
    const seen = new Set(curRows.map((r) => r.id));
    return [...curRows, ...all.filter((r) => !seen.has(r.id))];
  }, [curRows, all]);

  // SBC-calendar rows start after incorporation: open on the first month that has one, once
  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current || !cur.data?.fromCalendar || !curRows.length) return;
    if (curRows.some((r) => r.dueDate.startsWith(ym))) return;
    jumped.current = true;
    const first = [...curRows].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]!;
    setYmState(first.dueDate.slice(0, 7));
  }, [cur.data?.fromCalendar, curRows, ym]);

  /* ---------- badge (every overdue filing), search items (this FY + anything overdue), route intent */
  const overdue = curRows.filter((r) => statusOf(r, today) === 'over').length;
  useNavBadge('calendar', overdue || undefined);
  const items = useMemo<PaletteItem[]>(
    () =>
      curRows
        .filter((r) => fyStartOfMonth(r.dueDate.slice(0, 7)) === curFy || statusOf(r, today) === 'over')
        .map((r) => ({
        id: 'filing-' + r.id,
        label: r.name,
        kind: `${fmt(r.dueDate)} · ${ST_LABEL[statusOf(r, today)]}`,
        sw: lawVar(r.area),
        go: () => {
          go('calendar');
          openFiling(r, null);
        },
      })),
    [curRows, curFy, today, go, openFiling],
  );
  usePaletteItems('filings', items);
  useIntent(['filing'], cur.isSuccess, (i) => {
    const show = (r: PortalFiling) => {
      setYm(r.dueDate.slice(0, 7));
      setView('month');
      go('calendar');
      window.setTimeout(() => openFiling(r, null), 900);
    };
    const hit = curRows.find((r) => r.id === i.id);
    if (hit) return show(hit);
    void getJson<{ rows: PortalFiling[] }>(`/api/client/compliances?id=${encodeURIComponent(i.id)}`)
      .then((b) => {
        const r = b?.rows[0];
        if (r) show(r);
        else {
          go('calendar');
          toast('That filing is not in your register');
        }
      })
      .catch(() => toast('Could not open that filing'));
  });

  /* ---------- derived */
  const lawOk = (r: PortalFiling) => law === 'all' || r.area === law;
  const vis = (r: PortalFiling) => lawOk(r) && (!status || statusOf(r, today) === status);
  const scope = view === 'month' ? all.filter((r) => r.dueDate.startsWith(ym)) : all;

  if (q.isError) return (
    <>
      <SecHead title="Compliance calendar" />
      <SecError message="Your compliance calendar could not load." onRetry={() => void q.refetch()} />
    </>
  );
  if (q.isPending) return (
    <>
      <SecHead title="Compliance calendar" />
      <SecLoading label="Loading your compliance calendar…" />
    </>
  );
  if (!all.length && !curRows.length && fy === curFy && shell && !shell.incorporated) {
    return (
      <>
        <SecHead title="Compliance calendar" />
        <div className="glass panel">
          <p className="sec-empty">Your filings start after incorporation. Nothing is due yet.</p>
        </div>
      </>
    );
  }

  const [y, m] = ym.split('-').map(Number) as [number, number];
  const years = Array.from({ length: span.hi - span.lo + 2 }, (_, k) => span.lo + k);

  return (
    <>
      <SecHead title="Compliance calendar" />
      {cur.data?.fromCalendar ? (
        <div className="banner info" style={{ margin: '0 0 14px' }}>
          <Icon name="cal" />
          <div>
            <b>SBC’s compliance calendar for this year</b>
            <span>
              {shell?.companyShort || 'Your company'} has no filings on its register yet. These are the deadlines that will apply once it is incorporated and registered; SBC then adds them to your register and files them.
            </span>
          </div>
        </div>
      ) : null}
      <div className="glass ctool">
        <div className="mpick">
          <button type="button" className="ib" aria-label="Previous month" disabled={ym <= minYm} onClick={() => setYm(stepYm(ym, -1))}>
            <Icon name="chev" style={{ transform: 'rotate(180deg)' }} />
          </button>
          <select aria-label="Month" value={String(m).padStart(2, '0')} onChange={(e) => setYm(`${y}-${e.target.value}`)}>
            {MONL.map((n, i) => (
              <option key={n} value={String(i + 1).padStart(2, '0')}>
                {n}
              </option>
            ))}
          </select>
          <select aria-label="Year" value={String(y)} onChange={(e) => setYm(`${e.target.value}-${String(m).padStart(2, '0')}`)}>
            {years.map((yy) => (
              <option key={yy} value={String(yy)}>
                {yy}
              </option>
            ))}
          </select>
          <button type="button" className="ib" aria-label="Next month" disabled={ym >= maxYm} onClick={() => setYm(stepYm(ym, 1))}>
            <Icon name="chev" />
          </button>
        </div>
        <span className="fy">{fyLabelOf(fy)}</span>
        <Seg<Law>
          ariaLabel="Area of law"
          value={law}
          onChange={setLaw}
          options={[
            { value: 'all', label: 'All laws', n: scope.length },
            ...LAWS.map((l) => ({ value: l.k as Law, label: lawShort(l.k), dot: lawVar(l.k), n: scope.filter((r) => r.area === l.k).length })),
          ]}
        />
        <span className="sp" />
        <Seg<View>
          ariaLabel="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' },
            { value: 'timeline', label: 'Timeline' },
          ]}
        />
      </div>

      <Ribbon
        months={FYM}
        rows={all}
        today={today}
        law={law}
        sel={view === 'month' ? ym : null}
        onPick={(k) => {
          setYm(k);
          setView('month');
        }}
      />

      <div className="cal">
        <div>
          {view === 'month' ? (
            <MonthView
              ym={ym}
              rows={all.filter((r) => r.dueDate.startsWith(ym))}
              vis={vis}
              today={today}
              law={law}
              status={status}
              onReset={() => {
                setLaw('all');
                setStatus(null);
              }}
              onFiling={openFiling}
              onDay={openDay}
            />
          ) : view === 'year' ? (
            <YearView months={FYM} rows={all.filter(vis)} today={today} onMonth={(k) => (setYm(k), setView('month'))} onFiling={openFiling} onDay={openDay} />
          ) : (
            <div className="glass mg-wrap">
              <Lanes fy={fy} months={FYM} rows={all.filter((r) => !status || statusOf(r, today) === status)} today={today} ym={ym} onFiling={openFiling} onDay={openDay} />
            </div>
          )}
        </div>
        <Rail view={view} ym={ym} scope={scope.filter(lawOk)} rows={railRows} law={law} today={today} status={status} setStatus={setStatus} />
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- ribbon */

function Ribbon({ months, rows, today, law, sel, onPick }: { months: string[]; rows: PortalFiling[]; today: string; law: Law; sel: string | null; onPick: (ym: string) => void }) {
  const per = months.map((k) => rows.filter((r) => r.dueDate.startsWith(k) && (law === 'all' || r.area === law)));
  const max = Math.max(...per.map((l) => l.length), 1);
  const now = today.slice(0, 7);
  return (
    <div className="glass ribbon" role="group" aria-label="Filings per month">
      {months.map((k, i) => {
        const list = per[i]!;
        const hasOver = list.some((r) => statusOf(r, today) === 'over');
        const hasDue = list.some((r) => statusOf(r, today) === 'due');
        return (
          <button key={k} type="button" className={'rb' + (k === sel ? ' sel' : '') + (k === now ? ' now' : '')} title={`${MONL[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}: ${list.length} filing${list.length === 1 ? '' : 's'}`} onClick={() => onPick(k)}>
            <div className="flag">
              {hasOver ? <em style={{ background: 'var(--over)' }} /> : null}
              {hasDue ? <em style={{ background: 'var(--due)' }} /> : null}
            </div>
            <div className="bars">
              {LAWS.map((l) => {
                const n = list.filter((r) => r.area === l.k).length;
                return n ? <i key={l.k} style={{ height: `${(n / max) * 100}%`, background: lawVar(l.k), opacity: k < now ? 0.45 : 1 }} /> : null;
              })}
            </div>
            <b>{MON[Number(k.slice(5)) - 1]}</b>
            <span>{list.length}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- month */

type OpenFiling = (f: PortalFiling, anchor?: Element | null) => void;
type OpenDay = (iso: string, anchor?: Element | null) => void;

function MonthView({
  ym,
  rows,
  vis,
  today,
  law,
  status,
  onReset,
  onFiling,
  onDay,
}: {
  ym: string;
  rows: PortalFiling[];
  vis: (r: PortalFiling) => boolean;
  today: string;
  law: Law;
  status: FilingSt | null;
  onReset: () => void;
  onFiling: OpenFiling;
  onDay: OpenDay;
}) {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const vlist = rows.filter(vis);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const nd = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const over = vlist.filter((r) => statusOf(r, today) === 'over').length;
  const due = vlist.filter((r) => statusOf(r, today) === 'due').length;
  const cells = Math.ceil((lead + nd) / 7) * 7;
  const lawName = law === 'all' ? '' : LAWS.find((l) => l.k === law)!.name;
  const key = (e: KeyboardEvent<HTMLDivElement>, ds: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onDay(ds, e.currentTarget);
    }
  };
  return (
    <div className="glass mg-wrap">
      <div className="ph" style={{ margin: '4px 4px 14px', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ fontSize: 26, letterSpacing: '-.02em' }}>
            {MONL[m - 1]} {y}
          </h3>
          <div className="small">
            {vlist.length} filing{vlist.length === 1 ? '' : 's'}
            {lawName ? ` in ${lawName}` : ''}
            {status ? ` · showing ${ST_LABEL[status].toLowerCase()} only` : ''}
          </div>
        </div>
        <span className="sp" />
        {over ? (
          <span className="pill over">
            <Icon name="alert" />
            {over} overdue
          </span>
        ) : null}
        {due ? (
          <span className="pill due">
            <Icon name="clock" />
            {due} due within 7 days
          </span>
        ) : null}
        {status || law !== 'all' ? (
          <Btn cls="sm" onClick={onReset}>
            Show everything
          </Btn>
        ) : null}
      </div>
      <div className="mg">
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((w, i) => (
          <div key={w} className={'wd' + (i > 4 ? ' we' : '')}>
            {w}
          </div>
        ))}
        {Array.from({ length: cells }, (_, i) => {
          const day = i - lead + 1;
          if (day < 1 || day > nd) return <div key={i} className="cell out" aria-hidden="true" />;
          const ds = isoOf(y, m - 1, day);
          const list = byStatus(
            vlist.filter((r) => r.dueDate.slice(0, 10) === ds),
            today,
          );
          const st = list.length ? worstOf(list, today) : null;
          const we = i % 7 > 4;
          return (
            <div
              key={i}
              className={'cell' + (we ? ' we' : '') + (st === 'over' || st === 'due' ? ' s-' + st : '') + (ds === today ? ' today' : '')}
              role="button"
              tabIndex={0}
              aria-label={`${fmtL(ds)}: ${list.length} filing${list.length === 1 ? '' : 's'}`}
              onClick={(e) => onDay(ds, e.currentTarget)}
              onKeyDown={(e) => key(e, ds)}
            >
              {list.length ? (
                <div
                  className="glow"
                  style={{
                    background: `radial-gradient(130% 90% at 0% 0%, color-mix(in srgb, ${st === 'over' ? 'var(--over)' : lawVar(list[0]!.area)} ${st === 'ok' ? 10 : 24}%, transparent), transparent 70%)`,
                  }}
                />
              ) : null}
              <div className="top2">
                <span className="dn">{day}</span>
                {ds === today ? (
                  <span className="pill up" style={{ padding: '3px 7px', fontSize: 10 }}>
                    TODAY
                  </span>
                ) : null}
                {list.length > 1 ? <span className="ct">{list.length} filings</span> : null}
              </div>
              {list.slice(0, 3).map((r) => {
                const s = statusOf(r, today);
                return (
                  <button
                    key={r.id}
                    type="button"
                    data-fid={r.id}
                    className={'chip ' + s}
                    style={{ ['--lc' as string]: lawVar(r.area) }}
                    title={`${r.name} · ${r.period}`}
                    onClick={(e: MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      onFiling(r, e.currentTarget);
                    }}
                  >
                    {s === 'over' ? <Icon name="alert" /> : s === 'ok' ? <Icon name="check" /> : null}
                    <span>{r.name}</span>
                  </button>
                );
              })}
              {list.length > 3 ? (
                <button
                  type="button"
                  className="more"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDay(ds, e.currentTarget.parentElement);
                  }}
                >
                  +{list.length - 3} more
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- year wall */

const LAW_TAG: Record<LawKey, string> = { MCA: 'MCA', GST: 'GST', PAY: 'PAYROLL', IT: 'IT', FEMA: 'FEMA' };

function YearView({
  months,
  rows,
  today,
  onMonth,
  onFiling,
  onDay,
}: {
  months: string[];
  rows: PortalFiling[];
  today: string;
  onMonth: (ym: string) => void;
  onFiling: OpenFiling;
  onDay: OpenDay;
}) {
  return (
    <div>
      <div className="wall-key">
        <span>
          <i className="k" style={{ background: 'var(--over)', color: '#fff' }}>
            1
          </i>
          Overdue
        </span>
        <span>
          <i className="k" style={{ background: 'var(--due)', color: '#1b1200' }}>
            20
          </i>
          Due within 7 days
        </span>
        <span>
          <i className="k" style={{ background: 'var(--ice)', color: 'var(--prim-ink)' }}>
            7
          </i>
          Upcoming
        </span>
        <span>
          <i className="k" style={{ background: 'var(--done-bg)', color: 'var(--ink-2)' }}>
            11
          </i>
          Filed
        </span>
        <span>
          <i className="k" style={{ boxShadow: '0 0 0 2px var(--ink)' }}>
            {P(today).getUTCDate()}
          </i>
          Today
        </span>
        <span>
          <span className="tg">GST</span>
          Each line names its law
        </span>
        <span className="small" style={{ marginLeft: 'auto' }}>
          Click a date, a line, or a month name
        </span>
      </div>
      <div className="wall fadein">
        {months.map((k) => {
          const [y, m] = k.split('-').map(Number) as [number, number];
          const nd = new Date(Date.UTC(y, m, 0)).getUTCDate();
          const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
          const list = rows.filter((r) => r.dueDate.startsWith(k));
          const late = list.filter((r) => statusOf(r, today) === 'over').length;
          const days = groupsByDay(list, today);
          return (
            <section key={k} className={'wpage' + (k === today.slice(0, 7) ? ' now' : '')}>
              <div className="wp-h">
                <button type="button" title={`Open ${MONL[m - 1]}`} onClick={() => onMonth(k)}>
                  {MONL[m - 1]}
                </button>
                <span>{y}</span>
                <em className={late ? 'r' : ''}>
                  {list.length} filing{list.length === 1 ? '' : 's'}
                  {late ? ` · ${late} late` : ''}
                </em>
              </div>
              <div className="wp-g">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => (
                  <span key={i} className={'w' + (i > 4 ? ' we' : '')}>
                    {x}
                  </span>
                ))}
                {Array.from({ length: lead }, (_, i) => (
                  <span key={'l' + i} />
                ))}
                {Array.from({ length: nd }, (_, i) => {
                  const d = i + 1;
                  const ds = isoOf(y, m - 1, d);
                  const g = days.find((x) => x.d === ds);
                  const we = (lead + d - 1) % 7 > 4;
                  const cls = 'wp-d' + (we ? ' we' : '') + (g ? ' s-' + g.st : '') + (ds === today ? ' td' : '');
                  return g ? (
                    <button key={d} type="button" className={cls} title={`${fmtL(ds)} · ${g.items.map((r) => r.name).join(', ')}`} onClick={(e) => onDay(ds, e.currentTarget)}>
                      {d}
                    </button>
                  ) : (
                    <span key={d} className={cls}>
                      {d}
                    </span>
                  );
                })}
              </div>
              {days.length ? (
                <div className="wp-l">
                  {days.slice(0, 6).map((g) => (
                    <button
                      key={g.d}
                      type="button"
                      className="wp-r"
                      onClick={(e) => (g.items.length > 1 ? onDay(g.d, e.currentTarget) : onFiling(g.lead, e.currentTarget))}
                    >
                      <span className={'dn s-' + g.st}>{P(g.d).getUTCDate()}</span>
                      <span className={'t' + (g.st === 'ok' ? ' ok' : '')}>
                        {g.lead.name}
                        {g.items.length > 1 ? `  +${g.items.length - 1}` : ''}
                      </span>
                      <span className="tg">{LAW_TAG[g.lead.area]}</span>
                    </button>
                  ))}
                  {days.length > 6 ? (
                    <button type="button" className="wp-more" onClick={() => onMonth(k)}>
                      +{days.length - 6} more dates · open {MONL[m - 1]} →
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="small">Nothing due.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- timeline lanes */

function Lanes({
  fy,
  months,
  rows,
  today,
  ym,
  onFiling,
  onDay,
}: {
  fy: number;
  months: string[];
  rows: PortalFiling[];
  today: string;
  ym: string;
  onFiling: OpenFiling;
  onDay: OpenDay;
}) {
  const W = 1000;
  const L = 130;
  const Rr = 20;
  const top = 34;
  const LH = 58;
  const H = top + LAWS.length * LH + 10;
  const FY0 = P(`${fy}-04-01`).getTime();
  const FY1 = P(`${fy + 1}-04-01`).getTime();
  const x = (s: string) => L + ((P(s).getTime() - FY0) / (FY1 - FY0)) * (W - L - Rr);
  const clampX = (s: string) => Math.min(Math.max(x(s), L), W - Rr);
  const showToday = today >= `${fy}-04-01` && today < `${fy + 1}-04-01`;
  const tx = x(today);
  return (
    <div className="lanes-sc">
      <svg id="lanesvg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Filings in one lane per area of law across the year">
        {months.map((k) => {
          const x0 = x(`${k}-01`);
          return (
            <g key={k}>
              <line x1={x0} y1={top - 8} x2={x0} y2={H - 6} style={{ stroke: 'var(--line-2)' }} />
              <text x={x0 + 6} y={top - 14} style={{ fill: k === ym ? 'var(--ice)' : 'var(--ink-3)', font: '700 11px var(--f-disp)', letterSpacing: '.08em' }}>
                {MON[Number(k.slice(5)) - 1]!.toUpperCase()}
              </text>
            </g>
          );
        })}
        {LAWS.map((l, li) => {
          const yy = top + li * LH + LH / 2;
          const list = rows.filter((r) => r.area === l.k);
          return (
            <g key={l.k}>
              <rect x="8" y={yy - 14} width={L - 20} height="28" rx="8" style={{ fill: `color-mix(in srgb, ${lawVar(l.k)} 16%, transparent)` }} />
              <text x="18" y={yy + 4.5} style={{ fill: 'var(--ink)', font: '600 12.5px var(--f-disp)' }}>
                {lawShort(l.k)}
              </text>
              <line x1={L} y1={yy} x2={W - Rr} y2={yy} style={{ stroke: `color-mix(in srgb, ${lawVar(l.k)} 40%, transparent)` }} strokeWidth="2" />
              {list
                .filter((r) => r.windowFrom && r.windowTo && !r.filedOn)
                .map((r) => (
                  <rect key={'w' + r.id} x={clampX(r.windowFrom!)} y={yy - 9} width={Math.max(3, clampX(r.windowTo!) - clampX(r.windowFrom!))} height="18" rx="6" style={{ fill: lawVar(l.k), opacity: 0.22 }}>
                    <title>
                      {r.name} · your working window {fmt(r.windowFrom!)} – {fmt(r.windowTo!)}
                    </title>
                  </rect>
                ))}
              {groupsByDay(list, today).map((g) => {
                const cx = x(g.d).toFixed(1);
                const col = g.st === 'ok' ? 'var(--done)' : g.st === 'over' ? 'var(--over)' : lawVar(l.k);
                const rr = g.st === 'over' ? 8 : g.st === 'due' ? 7 : g.st === 'ok' ? 4 : 5.5;
                return (
                  <g key={g.d}>
                    {g.st === 'due' ? <circle cx={cx} cy={yy} r={rr + 4} fill="none" style={{ stroke: 'var(--due)' }} strokeWidth="2" /> : null}
                    <circle
                      className="lane-dot"
                      cx={cx}
                      cy={yy}
                      r={rr}
                      tabIndex={0}
                      role="button"
                      aria-label={`${fmt(g.d)} · ${g.lead.name}${g.items.length > 1 ? ` and ${g.items.length - 1} more` : ''}`}
                      style={{ fill: col, fillOpacity: g.st === 'ok' ? 0.55 : 1, cursor: 'pointer' }}
                      onClick={(e) => (g.items.length > 1 ? onDay(g.d, e.currentTarget) : onFiling(g.lead, e.currentTarget))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (g.items.length > 1) onDay(g.d, e.currentTarget);
                          else onFiling(g.lead, e.currentTarget);
                        }
                      }}
                    >
                      <title>
                        {fmt(g.d)} · {g.lead.name}
                        {g.items.length > 1 ? ` (+${g.items.length - 1})` : ''}
                      </title>
                    </circle>
                  </g>
                );
              })}
            </g>
          );
        })}
        {showToday ? (
          <g>
            <line x1={tx} y1={top - 8} x2={tx} y2={H - 6} style={{ stroke: 'var(--ice)' }} strokeWidth="2" />
            <rect x={tx - 30} y={H - 22} width="60" height="18" rx="9" style={{ fill: 'var(--ice)' }} />
            <text x={tx} y={H - 9.5} textAnchor="middle" style={{ fill: 'var(--prim-ink)', font: '700 10px var(--f-disp)' }}>
              TODAY
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------- rail */

function Rail({
  view,
  ym,
  scope,
  rows,
  law,
  today,
  status,
  setStatus,
}: {
  view: View;
  ym: string;
  /** what the donut counts: the month (or year) on screen, law-filtered */
  scope: PortalFiling[];
  /** the current FY plus the FY on screen: the next deadline and the list run from today */
  rows: PortalFiling[];
  law: Law;
  today: string;
  status: FilingSt | null;
  setStatus: (s: FilingSt | null) => void;
}) {
  const { openFiling } = useFilingActions();
  const live = rows.filter((r) => law === 'all' || r.area === law);
  const up = live
    .filter((r) => !r.filedOn && r.dueDate >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
  // the countdown card is for the company's own deadlines; SBC-calendar lines (before the register exists) stay in Coming up
  const nd = up.find((r) => !r.fromCalendar) ?? null;
  const over = live.filter((r) => statusOf(r, today) === 'over').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const in30 = up.filter((r) => daysTo(r.dueDate, today) <= 30).length;
  return (
    <div className="rail">
      <section className="glass panel">
        <div className="ph" style={{ marginBottom: 10 }}>
          <h3>{view === 'month' ? `${MONL[Number(ym.slice(5)) - 1]} at a glance` : 'The year at a glance'}</h3>
        </div>
        <Donut<FilingSt> segs={statusSegs(scope, today)} sel={status} onPick={setStatus} centerTop={view === 'month' ? 'THIS MONTH' : 'THIS YEAR'} />
      </section>
      <section className="glass panel nd-card">
        <div className="ph" style={{ marginBottom: 0 }}>
          <h3>Next deadline</h3>
          <span className="sp" />
          {nd ? <LawChip law={nd.area} /> : null}
        </div>
        {nd ? (
          <NextDeadline f={nd} today={today} />
        ) : (
          <p className="small" style={{ marginTop: 10 }}>
            {up.length ? 'No deadline on your register yet. Your first filings start after incorporation.' : 'Nothing coming up.'}
          </p>
        )}
        {over.map((r) => (
          <button key={r.id} type="button" className="cu" style={{ marginTop: 12, background: 'var(--over-bg)' }} onClick={(e) => openFiling(r, e.currentTarget)}>
            <DateTile iso={r.dueDate} st="over" />
            <div style={{ minWidth: 0 }}>
              <div className="tt">{r.name}</div>
              <div className="ss">
                <span className="small" style={{ color: 'var(--over-ink)', fontWeight: 600 }}>
                  Overdue {-daysTo(r.dueDate, today)} days
                </span>
              </div>
            </div>
            <Icon name="chev" size={16} />
          </button>
        ))}
      </section>
      <section className="glass panel">
        <div className="ph" style={{ marginBottom: 6 }}>
          <h3>Coming up</h3>
          <span className="sp" />
          <span className="pill mut">{in30} in 30 days</span>
        </div>
        {up.length ? (
          up.slice(0, 6).map((r) => {
            const st = statusOf(r, today);
            return (
              <button key={r.id} type="button" className="cu" onClick={(e) => openFiling(r, e.currentTarget)}>
                <DateTile iso={r.dueDate} st={st === 'due' ? 'due' : null} />
                <div style={{ minWidth: 0 }}>
                  <div className="tt">{r.name}</div>
                  <div className="ss">
                    <LawChip law={r.area} />
                    <span className="small">{rel(daysTo(r.dueDate, today))}</span>
                  </div>
                </div>
                <Icon name="chev" size={16} />
              </button>
            );
          })
        ) : (
          <p className="small" style={{ marginTop: 8 }}>
            Nothing coming up.
          </p>
        )}
      </section>
    </div>
  );
}

function NextDeadline({ f, today }: { f: PortalFiling; today: string }) {
  const { openFiling } = useFilingActions();
  const reminder = useReminder(f);
  const n = daysTo(f.dueDate, today);
  return (
    <>
      <div className="big">
        <div className="bigday">
          <b>{n}</b>
          <span>{n === 1 ? 'DAY' : 'DAYS'}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: '700 16px/1.3 var(--f-disp)' }}>{f.name}</div>
          <div className="small">
            {fmtL(f.dueDate)} · {f.ownerName ? `${f.ownerName} at SBC` : 'SBC files it'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <Btn cls="sm pri" ico="doc" onClick={(e) => openFiling(f, e.currentTarget)}>
          Open filing
        </Btn>
        <Btn cls="sm" ico="bell" disabled={reminder.busy} onClick={() => void reminder.toggle()}>
          {f.reminderOn ? `Reminder ${fmt(f.reminderOn)}` : 'Remind me'}
        </Btn>
      </div>
    </>
  );
}
