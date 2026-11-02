'use client';

/**
 * The year in orbit (prototype a2_home.js drawOrbit + tooltips): the current
 * financial year as a dial, April at the top, one ring per area of law, a dot
 * per filing on its due date (red glow = overdue, gold ring = due within 7
 * days, grey = filed), the "today" hand, a month hover with a mini calendar,
 * and the company at the centre with one segment per set-up step.
 *
 * Everything is real: rows from useFilings() (this FY), steps from the step
 * model; the dock count from the items the section computed.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as RMouseEvent, type ReactNode } from 'react';
import type { AreaCode, PortalFiling } from '@/lib/client-portal/compliances';
import type { PortalIncorporationModel } from '@/lib/client-portal/step-model';
import { useFx, usePortal } from '../../runtime';
import { Btn, Icon, LAW_BY, lawVar, type LawKey } from '../../ui';
import { ModalBox } from '../../overlays';
import { daysTo, fmtL, fyOf, iso, MON, MONL, P, rel } from '../../dates';
import { useFilingActions } from '../filings/actions';
import { groupsOf, monthStats, shortName, worstOf, type OrbitGroup } from './model';

/* ---------------------------------------------------------------- geometry (prototype constants) */

const OW = 760;
const OC = 380;
const CORE = 66;
const RING0 = 108;
const RGAP = 50;
const RM = 334;
const ML = 356;
const TOP = -Math.PI / 2;
/** Rings, inside → out. */
const ORB: [LawKey, string][] = [
  ['IT', 'INCOME TAX'],
  ['PAY', 'PAYROLL'],
  ['GST', 'GST'],
  ['MCA', 'MCA'],
  ['FEMA', 'FEMA · RBI'],
];
const ringOf = (k: AreaCode) => RING0 + ORB.findIndex((o) => o[0] === k) * RGAP;
const mAng = (m: number) => TOP + (m / 12) * 2 * Math.PI;
const px = (r: number, a: number) => +(OC + Math.cos(a) * r).toFixed(1);
const py = (r: number, a: number) => +(OC + Math.sin(a) * r).toFixed(1);
const annulus = (r0: number, r1: number, a0: number, a1: number) => {
  const big = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${px(r1, a0)} ${py(r1, a0)} A ${r1} ${r1} 0 ${big} 1 ${px(r1, a1)} ${py(r1, a1)} L ${px(r0, a1)} ${py(r0, a1)} A ${r0} ${r0} 0 ${big} 0 ${px(r0, a0)} ${py(r0, a0)} Z`;
};
const arc = (r: number, a0: number, a1: number) => `M ${px(r, a0)} ${py(r, a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${px(r, a1)} ${py(r, a1)}`;

/* ---------------------------------------------------------------- component */

export function Orbit({
  rows,
  today,
  model,
  dockCount,
  onDock,
}: {
  rows: PortalFiling[];
  today: string;
  model: PortalIncorporationModel;
  dockCount: number;
  onDock: () => void;
}) {
  const { go, openModal, shell } = usePortal();
  const { openFiling, openDay } = useFilingActions();
  const [muted, setMuted] = useState<Set<LawKey>>(() => new Set());
  /** No filings on the register yet: every dot is a line from SBC's compliance calendar (data.ts useFilings). */
  const calendarMode = rows.length > 0 && rows.every((r) => r.fromCalendar);
  const company = shell?.companyShort || 'Your company';
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const fy = useMemo(() => fyOf(today), [today]);
  const FY0 = P(fy.from).getTime();
  const FY1 = P(`${fy.start + 1}-04-01`).getTime();
  const FYM = useMemo(() => Array.from({ length: 12 }, (_, m) => `${fy.start + (m >= 9 ? 1 : 0)}-${String(((m + 3) % 12) + 1).padStart(2, '0')}`), [fy.start]);
  const ang = useCallback((s: string) => ((P(s).getTime() - FY0) / (FY1 - FY0)) * 2 * Math.PI + TOP, [FY0, FY1]);
  const ta = ang(today);
  const curM = FYM.indexOf(today.slice(0, 7));
  const curQ = Math.floor((curM < 0 ? 0 : curM) / 3);

  const visible = useMemo(() => rows.filter((r) => !muted.has(r.area)), [rows, muted]);
  const groups = useMemo(() => groupsOf(visible, today), [visible, today]);
  const counts = useMemo(() => {
    const c: Record<LawKey, number> = { MCA: 0, GST: 0, PAY: 0, IT: 0, FEMA: 0 };
    for (const r of rows) c[r.area]++;
    return c;
  }, [rows]);

  /* ---------- tooltips */
  const [ftip, setFtip] = useState<{ gi: number; x: number; y: number } | null>(null);
  const [mtipM, setMtipM] = useState<number>(-1);
  const mTimer = useRef(0);
  const svgPt = useCallback((cx: number, cy: number): [number, number, number] => {
    const box = svgRef.current?.getBoundingClientRect();
    const wrap = wrapRef.current?.getBoundingClientRect();
    if (!box || !wrap) return [0, 0, 0];
    return [(cx / OW) * box.width + box.left - wrap.left, (cy / OW) * box.height + box.top - wrap.top, wrap.width];
  }, []);

  const onOver = (e: RMouseEvent<SVGSVGElement>) => {
    const t = e.target as Element;
    const mh = t.closest('.o-mhit') as SVGGElement | null;
    if (mh) {
      setFtip(null);
      window.clearTimeout(mTimer.current);
      const m = Number(mh.dataset.m);
      mTimer.current = window.setTimeout(() => setMtipM(m), mtipM >= 0 ? 60 : 160);
      return;
    }
    const c = t.closest('.o-hit') as SVGCircleElement | null;
    if (!c) return;
    window.clearTimeout(mTimer.current);
    setMtipM(-1);
    const [x, y] = svgPt(Number(c.getAttribute('cx')), Number(c.getAttribute('cy')));
    setFtip({ gi: Number(c.dataset.g), x, y });
  };
  const onOut = (e: RMouseEvent<SVGSVGElement>) => {
    const t = e.target as Element;
    const to = e.relatedTarget as Element | null;
    if (t.closest('.o-hit')) setFtip(null);
    if (t.closest('.o-mhit') && !(to && to.closest && to.closest('.o-mhit'))) {
      window.clearTimeout(mTimer.current);
      setMtipM(-1);
    }
  };
  const goMonth = () => {
    setMtipM(-1);
    go('calendar');
  };
  const onClick = (e: RMouseEvent<SVGSVGElement>) => {
    const t = e.target as Element;
    if (t.closest('.o-mhit')) return goMonth();
    const c = t.closest('.o-hit') as SVGCircleElement | null;
    if (c) {
      setFtip(null);
      const g = groups[Number(c.dataset.g)];
      if (!g) return;
      if (g.items.length > 1) openDay(g.d, c);
      else openFiling(g.lead, c);
      return;
    }
    if (t.closest('#ocore')) go('incorporation');
    if (t.closest('#odock')) onDock();
  };
  const onKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target as Element;
    if (t.closest('.o-mhit')) {
      e.preventDefault();
      goMonth();
    } else if (t.closest('#ocore')) {
      e.preventDefault();
      go('incorporation');
    } else if (t.closest('#odock')) {
      e.preventDefault();
      onDock();
    }
  };
  useEffect(() => () => window.clearTimeout(mTimer.current), []);

  /* ---------- the core: one segment per set-up step, green when built */
  const steps = model.steps;
  const builtN = model.all.done;
  const total = model.all.total;
  const segs = useMemo(() => {
    const N = steps.length;
    if (!N) return [];
    const gap = N > 24 ? 0.035 : 0.06;
    const span = (2 * Math.PI) / N;
    return steps.map((s, i) => {
      const a0 = TOP + i * span + gap / 2;
      const a1 = TOP + (i + 1) * span - gap / 2;
      return { d: arc(50, a0, a1), done: s.kind === 'done', title: `${s.n}. ${s.title}` };
    });
  }, [steps]);

  const overLabels: ReactNode[] = [];
  const dockEndA = Math.cos(ta) < 0;
  const dx = px(RING0 - 22, ta);
  const dy = py(RING0 - 22, ta);
  const tx = px(RING0 + RGAP * 2.5, ta);
  const ty = py(RING0 + RGAP * 2.5, ta);

  return (
    <>
      <div className="ph" style={{ marginBottom: 0 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <span className="eyebrow">
            The year in orbit · April {fy.start} → March {fy.start + 1}
          </span>
        </div>
        <Btn cls="sm" ico="help" onClick={() => openModal(<HelpModal />, { label: 'How to read the orbit' })}>
          How to read
        </Btn>
      </div>
      <div className="owrap" id="owrap" ref={wrapRef} onMouseLeave={() => { setFtip(null); window.clearTimeout(mTimer.current); setMtipM(-1); }}>
        <svg
          id="orbitsvg"
          ref={svgRef}
          viewBox={`0 0 ${OW} ${OW}`}
          role="img"
          aria-label="Orbit of the financial year: rings are areas of law, dots are filings on their due dates, the bright line is today"
          onMouseOver={onOver}
          onMouseOut={onOut}
          onClick={onClick}
          onKeyDown={onKey}
          onFocus={(e) => {
            const mh = (e.target as Element).closest('.o-mhit') as SVGGElement | null;
            if (mh) setMtipM(Number(mh.dataset.m));
          }}
          onBlur={(e) => {
            if ((e.target as Element).closest('.o-mhit')) setMtipM(-1);
          }}
        >
          <defs>
            <filter id="osh" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="6" stdDeviation="9" floodOpacity=".18" />
            </filter>
          </defs>
          {[0, 1, 2, 3].map((q) => (
            <path key={q} className={'o-q ' + (q < curQ ? 'past' : q === curQ ? 'cur' : 'fut')} d={annulus(CORE + 2, RM, mAng(q * 3), mAng(q * 3 + 3))} />
          ))}
          {FYM.map((_, m) => (
            <path key={m} className={'o-wedge' + (m === mtipM ? ' on' : '')} d={annulus(CORE + 2, RM, mAng(m), mAng(m + 1))} />
          ))}
          {FYM.map((_, m) => {
            const a = mAng(m);
            return <line key={m} className={'o-spoke' + (m % 3 === 0 ? ' q' : '')} x1={px(RING0 - 18, a)} y1={py(RING0 - 18, a)} x2={px(RM, a)} y2={py(RM, a)} />;
          })}
          {ORB.map(([k], i) => (
            <circle key={k} className="o-ring" cx={OC} cy={OC} r={RING0 + i * RGAP} style={muted.has(k) ? { opacity: 0.3 } : undefined} />
          ))}
          {FYM.map((_, m) => {
            const am = mAng(m + 0.5);
            const mi = (m + 3) % 12;
            const lx = px(ML, am);
            const ly = py(ML, am);
            return (
              <g key={m} className={'o-mhit' + (m === mtipM ? ' hot' : '')} data-m={m} tabIndex={0} role="button" aria-label={`${MONL[mi]}: preview, click to open in the calendar`}>
                <path d={annulus(RM + 2, RM + 44, mAng(m) + 0.01, mAng(m + 1) - 0.01)} fill="transparent" />
                <rect className="o-mpill" x={(lx - 25).toFixed(1)} y={(ly - 13).toFixed(1)} width="50" height="26" rx="13" />
                <text className={'o-month' + (m === curM ? ' now' : '')} x={lx} y={(ly + 5).toFixed(1)} textAnchor="middle">
                  {MON[mi]}
                </text>
              </g>
            );
          })}
          {groups.map((g, gi) => {
            const R = ringOf(g.law);
            const a = ang(g.d);
            const x = px(R, a);
            const y = py(R, a);
            const col = g.st === 'ok' ? 'var(--o-filed)' : g.st === 'over' ? 'var(--over)' : lawVar(g.law);
            const rr = g.st === 'over' ? 7.5 : g.st === 'due' ? 6.8 : g.st === 'ok' ? 3.6 : 5.4;
            if (g.lead.fromCalendar)
              // a line from SBC's compliance calendar, not a filing on the register: a hollow, dashed ring in the law's colour
              return (
                <g key={gi}>
                  <circle cx={x} cy={y} r={5.4} fill="none" strokeWidth="2" strokeDasharray="2.4 2" style={{ stroke: col }} />
                  <circle className="o-hit" data-g={gi} cx={x} cy={y} r="11" />
                </g>
              );
            if (g.st === 'over')
              overLabels.push(
                // label on the outer side of the dot so it never runs off the dial
                <text key={gi} className="o-overlbl" x={(x < OC ? x - 16 : x + 16).toFixed(1)} y={(y + 4).toFixed(1)} textAnchor={x < OC ? 'end' : 'start'}>
                  {shortName(g.lead.name)} · OVERDUE
                </text>,
              );
            return (
              <g key={gi}>
                {g.st === 'over' ? <circle className="o-halo-over pulse" cx={x} cy={y} r={rr + 8} /> : null}
                {g.st === 'due' ? <circle cx={x} cy={y} r={rr + 5} fill="none" style={{ stroke: 'var(--due)' }} strokeWidth="2.4" /> : null}
                <circle cx={x} cy={y} r={rr} style={{ fill: col }} />
                <circle className="o-hit" data-g={gi} cx={x} cy={y} r="11" />
              </g>
            );
          })}
          {overLabels}
          {ORB.map(([k, tag], i) => (
            <text key={k} className="o-lawtx" x={OC + 10} y={OC - (RING0 + i * RGAP) - 6} style={{ fill: lawVar(k), opacity: muted.has(k) ? 0.35 : 1 }}>
              {tag}
            </text>
          ))}
          <g className="o-sweepg">
            <line x1={px(CORE, ta)} y1={py(CORE, ta)} x2={px(RM + 14, ta)} y2={py(RM + 14, ta)} className="o-hand" />
            <circle className="o-handtip" cx={px(RM + 14, ta)} cy={py(RM + 14, ta)} r="5.5" />
          </g>
          <rect className="o-today-bg" x={(tx - 34).toFixed(1)} y={(ty - 12).toFixed(1)} width="68" height="24" rx="6" />
          <text className="o-today-tx" x={tx} y={(ty + 4.5).toFixed(1)} textAnchor="middle">
            TODAY
          </text>
          {dockCount > 0 ? (
            <g id="odock" className="o-dock" role="button" tabIndex={0} aria-label={`Your dock: ${dockCount} waiting on you`}>
              <text x={(dx + (dockEndA ? 14 : -14)).toFixed(1)} y={(dy + 4).toFixed(1)} textAnchor={dockEndA ? 'start' : 'end'}>
                ◤ YOUR DOCK · {dockCount} HOLD{dockCount > 1 ? 'S' : ''}
              </text>
            </g>
          ) : null}
          <g id="ocore" style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label={`Set-up journey: ${builtN} of ${total} steps built`}>
            <circle className="o-core" cx={OC} cy={OC} r={CORE} filter="url(#osh)" />
            {segs.length ? (
              segs.map((s, i) => <path key={i} d={s.d} fill="none" strokeWidth="9" strokeLinecap="butt" style={{ stroke: s.done ? 'var(--ok-green)' : 'var(--o-track)' }} />)
            ) : (
              <circle cx={OC} cy={OC} r="50" fill="none" strokeWidth="9" style={{ stroke: 'var(--o-track)' }} />
            )}
            <text className="o-core-n" x={OC} y={OC + 6} textAnchor="middle">
              {builtN}/{total}
            </text>
            <text className="o-core-k" x={OC} y={OC + 23} textAnchor="middle">
              BUILT
            </text>
            <title>
              {builtN} of {total} set-up steps built · open Incorporation
            </title>
          </g>
        </svg>
        <FilingTip tip={ftip} groups={groups} today={today} />
        <MonthTip m={mtipM} FYM={FYM} rows={rows} today={today} fyLabel={fy.label} at={(m) => svgPt(px(ML, mAng(m + 0.5)), py(ML, mAng(m + 0.5)))} />
      </div>
      <div className="ochips" id="ochips">
        {[...ORB].reverse().map(([k]) => (
          <button
            key={k}
            type="button"
            className="och"
            style={{ ['--lc' as string]: lawVar(k) }}
            aria-pressed={!muted.has(k)}
            title="Show or hide this area of law"
            onClick={() =>
              setMuted((s) => {
                const n = new Set(s);
                if (n.has(k)) n.delete(k);
                else n.add(k);
                return n;
              })
            }
          >
            <i />
            {LAW_BY[k].name}
            <b>{counts[k]}</b>
          </button>
        ))}
      </div>
      <div className="olegend">
        <span>
          <i style={{ background: 'var(--over)', boxShadow: '0 0 8px var(--over)' }} />
          Overdue
        </span>
        <span>
          <i style={{ border: '2px solid var(--due)' }} />
          Due within 7 days
        </span>
        <span>
          <i style={{ background: 'var(--ink-2)' }} />
          Upcoming
        </span>
        <span>
          <i style={{ background: 'var(--done)', opacity: 0.55 }} />
          Filed
        </span>
        {calendarMode ? (
          <span>
            <i style={{ border: '2px dashed var(--ink-2)', background: 'transparent' }} />
            From SBC’s compliance calendar
          </span>
        ) : null}
      </div>
      {rows.length === 0 ? <div className="sec-empty">No filings on the register for {fy.label} yet. SBC adds them as your registrations come through.</div> : null}
      {calendarMode ? (
        <div className="sec-empty" style={{ paddingTop: 10 }}>
          {company} has no filings on its register yet. The dashed rings are SBC’s compliance calendar for {fy.label}: the deadlines that will apply once {company} is incorporated and registered.
        </div>
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------- tooltips */

function FilingTip({ tip, groups, today }: { tip: { gi: number; x: number; y: number } | null; groups: OrbitGroup[]; today: string }) {
  const { mounted, shown } = useFx(Boolean(tip), 300);
  const last = useRef(tip);
  if (tip) last.current = tip;
  const cur = tip ?? last.current;
  const g = cur ? groups[cur.gi] : undefined;
  const wrapW = useRef(0);
  useLayoutEffect(() => {
    wrapW.current = (document.getElementById('owrap')?.getBoundingClientRect().width ?? 0) || wrapW.current;
  });
  if (!mounted || !cur || !g) return null;
  const st = g.st;
  const dd = daysTo(g.d, today);
  const ww = wrapW.current || 600;
  return (
    <div className={'tip' + (shown && tip ? ' on' : '')} id="otip" style={{ left: Math.min(Math.max(cur.x, 150), ww - 150), top: cur.y }}>
      <div className="m">
        {fmtL(g.d)} · {LAW_BY[g.law].name}
      </div>
      <b>{g.lead.name}</b>
      {g.lead.fromCalendar ? (
        <span style={{ font: '600 12.5px var(--f-disp)', color: 'var(--ink-2)' }}>From SBC’s compliance calendar · applies once you are incorporated</span>
      ) : (
        <span style={{ font: '600 12.5px var(--f-disp)', color: st === 'over' ? 'var(--over-ink)' : st === 'due' ? 'var(--due-ink)' : 'var(--ink-2)' }}>
          {st === 'ok' ? 'Filed' : st === 'over' ? `Overdue by ${-dd} day${dd === -1 ? '' : 's'}` : dd === 0 ? 'Due today' : `Due ${rel(dd)} · SBC files it`}
        </span>
      )}
      {g.items.length > 1 ? (
        <div className="m" style={{ marginTop: 3 }}>
          +{g.items.length - 1} more on this date
        </div>
      ) : null}
    </div>
  );
}

function MonthTip({
  m,
  FYM,
  rows,
  today,
  fyLabel,
  at,
}: {
  m: number;
  FYM: string[];
  rows: PortalFiling[];
  today: string;
  fyLabel: string;
  at: (m: number) => [number, number, number];
}) {
  const open = m >= 0;
  const { mounted, shown } = useFx(open, 420);
  const last = useRef(m);
  if (open) last.current = m;
  const cur = open ? m : last.current;
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !open) return;
    const [x, yy, ww] = at(cur);
    const H = el.offsetHeight;
    el.style.left = `${Math.min(Math.max(x, 150), ww - 150)}px`;
    el.style.top = `${yy - H - 24 < 0 ? yy + H + 40 : yy}px`;
  });
  if (!mounted || cur < 0) return null;
  const ym = FYM[cur]!;
  const [y, mo] = ym.split('-').map(Number) as [number, number];
  const { list, c } = monthStats(rows, ym, today);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const nd = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const bits = [c.over && `${c.over} overdue`, c.due && `${c.due} due soon`, c.up && `${c.up} upcoming`, c.ok && `${c.ok} filed`].filter(Boolean).join(' · ');
  const cells: ReactNode[] = [];
  for (let i = 0; i < lead; i++) cells.push(<span key={`l${i}`} />);
  for (let d = 1; d <= nd; d++) {
    const ds = iso(y, mo - 1, d);
    const dl = list.filter((r) => r.dueDate === ds);
    const laws = [...new Set(dl.map((r) => r.area))];
    cells.push(
      <span key={ds} className={(dl.length ? 'has s-' + worstOf(dl, today) : '') + (ds === today ? ' td' : '')}>
        {d}
        {dl.length ? (
          <i>
            {laws.map((k) => (
              <em key={k} style={{ background: lawVar(k) }} />
            ))}
          </i>
        ) : null}
      </span>,
    );
  }
  return (
    <div ref={ref} className={'tip mtip' + (shown && open ? ' on' : '')} id="mtip">
      <div className="m">
        {fyLabel} · month {cur + 1} of 12
      </div>
      <b>
        {MONL[mo - 1]} {y}
      </b>
      <div className="m" style={{ color: 'var(--ink-2)' }}>
        {list.length} filing{list.length === 1 ? '' : 's'}
        {bits ? ` · ${bits}` : ''}
      </div>
      <div className="wd">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => (
          <span key={i}>{x}</span>
        ))}
      </div>
      <div className="g">{cells}</div>
      <div className="cta">Click to open the calendar →</div>
    </div>
  );
}

/* ---------------------------------------------------------------- how to read */

function HelpModal() {
  return (
    <ModalBox
      title="How to read the orbit"
      label="How to read the orbit"
      foot={
        <button type="button" className="btn pri" data-close>
          Got it
        </button>
      }
    >
      <div style={{ marginTop: 10 }}>
        <Row
          svg={<circle cx="17" cy="17" r="12" fill="none" style={{ stroke: 'var(--ok-green)' }} strokeWidth="3.5" strokeDasharray="42 100" />}
          b="The centre is your company."
          s="One segment per set-up step. Green is built."
        />
        <Row
          svg={
            <>
              <circle cx="17" cy="17" r="6" fill="none" style={{ stroke: 'var(--law-IT)' }} strokeWidth="2.5" />
              <circle cx="17" cy="17" r="11" fill="none" style={{ stroke: 'var(--law-GST)' }} strokeWidth="2.5" />
              <circle cx="17" cy="17" r="15.5" fill="none" style={{ stroke: 'var(--law-FEMA)' }} strokeWidth="2.5" />
            </>
          }
          b="Each ring is one area of law."
          s="Income tax inside, then Payroll, GST, MCA, FEMA · RBI outside."
        />
        <Row
          svg={
            <>
              <circle cx="17" cy="17" r="13" fill="none" style={{ stroke: 'var(--line)' }} strokeWidth="2" />
              <path d="M17 2v6" style={{ stroke: 'var(--ink)' }} strokeWidth="2.4" />
            </>
          }
          b="The circle is the year."
          s="April at the top, clockwise. Hover a month to preview; click to open the calendar."
        />
        <Row
          svg={
            <>
              <path d="M17 17 L28 25" style={{ stroke: 'var(--ice)' }} strokeWidth="2.6" strokeLinecap="round" />
              <circle cx="28" cy="25" r="3.4" style={{ fill: 'var(--ice)' }} />
            </>
          }
          b="The bright line is today."
          s="Behind it: filed. Ahead: coming."
        />
        <Row
          svg={
            <>
              <circle cx="17" cy="17" r="6" style={{ fill: 'var(--law-GST)' }} />
              <circle cx="17" cy="17" r="10.5" fill="none" style={{ stroke: 'var(--due)' }} strokeWidth="2.2" />
            </>
          }
          b="Gold ring: due within 7 days."
          s="SBC is preparing it."
        />
        <Row
          svg={
            <>
              <circle cx="17" cy="17" r="13" style={{ fill: 'var(--over)' }} fillOpacity=".25" />
              <circle cx="17" cy="17" r="6.5" style={{ fill: 'var(--over)' }} />
            </>
          }
          b="Red glow: overdue."
          s="Past its due date. Open it to see who holds the next move."
        />
      </div>
    </ModalBox>
  );
}

function Row({ svg, b, s }: { svg: ReactNode; b: string; s: string }) {
  return (
    <div className="hrow">
      <svg viewBox="0 0 34 34">{svg}</svg>
      <div>
        <b>{b}</b>
        <span>{s}</span>
      </div>
    </div>
  );
}
