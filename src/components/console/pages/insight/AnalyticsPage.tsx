'use client';

/**
 * ANALYTICS — /app/manager/analytics and /app/intern/analytics (prototype a59r
 * + a59s mxRenderers.analytics: four numbers with their trend lines, two monthly
 * charts against a target, then a scorecard per project lead).
 *
 * Live functions kept (src/views/admin/Analytics.tsx): Last 6 / 12 months; the
 * four KPIs computed exactly as live — Projects, Steps completed (%), Waiting on
 * client, Overdue steps; the compliance completion rate against the 95% target
 * and the average filing delay against the 2-day benchmark. The live charts were
 * marked "Sample data"; here they are built from the filings register (real due
 * and filed dates), and the trend lines only where a real timestamp exists (see
 * analytics-model.ts). Every number opens its breakdown. The Stage filter applies.
 * The scorecards per project lead (prototype) show for the manager seat only.
 */
import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useFilings } from '@/lib/use-filings';
import { useConsole, useCrumbs } from '../../runtime';
import { Drill, type DrillRow, type DrillTab } from '../../overlays';
import { LeadAv, Panel, Seg, hueOf } from '../../ui';
import { F_COLOR, F_LABEL, T_COLOR, T_LABEL, firstName, stageOf, type TItem } from '../today/model';
import { useToday, useTodayIso } from '../today/useToday';
import { Ring } from '../today/bits';
import { TeamItemDrawer } from '../today/TeamDrawer';
import { buildKpis, buildTrends, filingMonths, leadCards, monthsBack, rateColor, type FilingMonth, type LeadCard, type Range, type StepRef } from './analytics-model';
import { dWords, plural } from './fmt';
import { clientHref, EmptyNote, ErrorBox, stepHref, useBookReady, useNavHref } from './shared';

const RATE_TARGET = 95;
const DELAY_BENCHMARK = 2;

export function AnalyticsPage() {
  useCrumbs(['Analytics']);
  const { engagements, getStateForEngagement } = useApp();
  const { seat, me, scope, base, go, openPop } = useConsole();
  const navHref = useNavHref();
  const today = useTodayIso();
  const ready = useBookReady();
  const filingsQ = useFilings();
  const [range, setRange] = useState<'6' | '12'>('6');
  const months = useMemo(() => monthsBack(today, Number(range) as Range), [today, range]);

  const scoped = useMemo(() => engagements.filter((e) => scope === 'all' || stageOf(e, getStateForEngagement(e)) === scope), [engagements, getStateForEngagement, scope]);
  const kpis = useMemo(() => buildKpis(scoped, getStateForEngagement), [scoped, getStateForEngagement]);
  const trends = useMemo(() => buildTrends(scoped, kpis, months), [scoped, kpis, months]);
  const fMonths = useMemo(() => {
    const ids = new Set(scoped.map((e) => e.id));
    return filingMonths((filingsQ.data?.rows ?? []).filter((r) => ids.has(r.engagementId)), months, today);
  }, [filingsQ.data, scoped, months, today]);

  const clientsHref = navHref('clients', '/projects');
  const filingsHref = navHref('filings', '/compliances/filings');
  const rangeWords = `last ${range} months`;
  const stepRows = (list: StepRef[], state: string, color: string): DrillRow[] =>
    list.map((s) => ({
      id: `${s.e.id}:${s.itemId}`,
      title: s.title,
      meta: `${s.e.companyName}${s.doneOn ? ` · done ${dWords(s.doneOn, today)}` : ''}`,
      state,
      color,
      onOpen: () => go(stepHref(base, s.e, s.itemId)),
    }));
  const drill = (el: Element, title: string, sub: string, tabs: DrillTab[]) =>
    openPop(el, <Drill title={title} sub={sub} tabs={tabs} link={{ text: 'Open clients', onClick: () => go(clientsHref) }} />, { cls: 'mx-wide' });

  const projectRow = (e: (typeof scoped)[number]): DrillRow => {
    const p = kpis.byProject.find((x) => x.e.id === e.id);
    return {
      id: e.id,
      title: e.companyName,
      meta: `${stageOf(e, getStateForEngagement(e)) === 'inc' ? 'Incorporating' : 'Compliance'}${e.createdAt ? ` · set up ${dWords(e.createdAt.slice(0, 10), today)}` : ''}`,
      state: p ? `${p.done} of ${p.total} steps` : '',
      color: hueOf(e.id),
      onOpen: () => go(clientHref(base, e)),
    };
  };

  const book = seat === 'lead' ? `${me ? firstName(me.name) + '’s' : 'Your'} clients` : `${me ? firstName(me.name) + '’s' : 'Your'} book`;
  const stageWords = scope === 'inc' ? ' · Incorporating' : scope === 'cmp' ? ' · Compliance' : '';

  return (
    <>
      <div className="sec-h">
        <h2>Analytics</h2>
        <span className="sec-count">{book + stageWords}</span>
        <span className="sp" />
        <Seg<'6' | '12'>
          className="sm"
          ariaLabel="Period"
          value={range}
          onChange={setRange}
          options={[
            { value: '6', label: 'Last 6 months' },
            { value: '12', label: 'Last 12 months' },
          ]}
        />
      </div>

      <div className="mx-kpis2">
        <Kpi
          label="Projects"
          value={ready ? String(kpis.projects) : '…'}
          delta={ready && trends.added.length ? { text: `+${trends.added.length}`, tone: 'mut', title: `${plural(trends.added.length, 'project')} set up in the ${rangeWords}` } : undefined}
          spark={ready ? { vals: trends.projects, tone: 'ins-n', title: `Projects on this list by the end of each month, counted from the month each was set up: ${trends.projects.join(', ')}` } : undefined}
          note={ready ? `${plural(trends.added.length, 'new project')} in the ${rangeWords}` : 'Loading…'}
          onOpen={(el) =>
            drill(el, 'Projects', `${plural(kpis.projects, 'project')} · ${trends.added.length} set up in the ${rangeWords}`, [
              { label: 'All', rows: scoped.map(projectRow) },
              { label: `New in ${range} months`, color: 'var(--ink-3)', rows: trends.added.map(projectRow) },
            ])
          }
        />
        <Kpi
          label="Steps completed"
          value={ready ? `${kpis.pct}%` : '…'}
          delta={ready && trends.doneInRange.length ? { text: `+${trends.doneInRange.length}`, tone: 'ok', title: `${plural(trends.doneInRange.length, 'step')} done in the ${rangeWords}` } : undefined}
          spark={
            ready
              ? {
                  vals: trends.steps,
                  tone: 'good',
                  title: `Steps done by the end of each month, from their done dates: ${trends.steps.join(', ')}${kpis.undated ? ` · ${plural(kpis.undated, 'done step')} carry no date and are not in the line` : ''}`,
                }
              : undefined
          }
          note={ready ? `${kpis.stepsDone} of ${plural(kpis.stepsTotal, 'step')} done` : 'Loading…'}
          onOpen={(el) =>
            drill(el, 'Steps completed', `${kpis.stepsDone} of ${plural(kpis.stepsTotal, 'step')} done · ${trends.doneInRange.length} in the ${rangeWords}`, [
              {
                label: 'By project',
                rows: kpis.byProject.map((p) => ({ id: p.e.id, title: p.e.companyName, meta: `${p.done} of ${p.total} steps done`, state: `${p.pct}%`, color: hueOf(p.e.id), onOpen: () => go(clientHref(base, p.e)) })),
              },
              { label: `Done in ${range} months`, color: 'var(--mx-ok)', rows: stepRows(trends.doneInRange, 'Done', 'var(--mx-ok)') },
            ])
          }
        />
        <Kpi
          label="Waiting on client"
          value={ready ? String(kpis.waiting.length) : '…'}
          note={ready ? 'Steps marked Awaiting client · no history kept' : 'Loading…'}
          onOpen={(el) => drill(el, 'Waiting on client', `${plural(kpis.waiting.length, 'step')} marked Awaiting client`, [{ label: 'Waiting on client', color: 'var(--mx-wait)', rows: stepRows(kpis.waiting, 'Waiting on client', 'var(--mx-wait)') }])}
        />
        <Kpi
          label="Overdue steps"
          value={ready ? String(kpis.overdue.length) : '…'}
          red={ready && kpis.overdue.length > 0}
          note={ready ? 'Steps marked Overdue · no history kept' : 'Loading…'}
          onOpen={(el) => drill(el, 'Overdue steps', `${plural(kpis.overdue.length, 'step')} marked Overdue`, [{ label: 'Overdue', color: 'var(--over)', rows: stepRows(kpis.overdue, 'Overdue', 'var(--over)') }])}
        />
      </div>

      {scope !== 'inc' ? (
        <div className="mx-row11">
          <FilingChart
            kind="rate"
            months={fMonths}
            q={filingsQ}
            today={today}
            onOpenMonth={(el, m) => openMonth(el, m)}
          />
          <FilingChart kind="delay" months={fMonths} q={filingsQ} today={today} onOpenMonth={(el, m) => openMonth(el, m)} />
        </div>
      ) : null}

      {seat === 'mgr' ? <LeadScorecards /> : null}
    </>
  );

  function openMonth(el: Element, m: FilingMonth) {
    const tab = (st: 'f' | 'l' | 'o'): DrillTab => ({
      label: F_LABEL[st],
      color: F_COLOR[st],
      rows: m.rows
        .filter((x) => x.st === st)
        .map((x) => ({
          id: x.row.id,
          title: `${x.name} · ${x.row.companyName}`,
          meta: `Due ${dWords(x.due, today)}${x.filedOn ? ` · filed ${dWords(x.filedOn, today)}` : ''}`,
          state: st === 'f' ? 'On time' : st === 'l' ? `${plural(x.lateDays, 'day')} late` : `${plural(x.lateDays, 'day')} overdue`,
          color: F_COLOR[st],
          onOpen: () => go(filingsHref),
        })),
    });
    openPop(
      el,
      <Drill
        title={`Filings due in ${m.label}`}
        sub={`${m.onTime} on time · ${m.late} late · ${m.open} still open`}
        tabs={[tab('f'), tab('l'), tab('o')]}
        active={m.open ? 2 : m.late ? 1 : 0}
        link={{ text: 'Open the filings register', onClick: () => go(filingsHref) }}
      />,
      { cls: 'mx-wide' },
    );
  }
}

/* ---------------------------------------------------------------- KPI tile */

function Kpi({
  label,
  value,
  delta,
  spark,
  note,
  red,
  onOpen,
}: {
  label: string;
  value: string;
  delta?: { text: string; tone: 'ok' | 'mut'; title: string };
  spark?: { vals: number[]; tone: 'good' | 'ins-n'; title: string };
  note: string;
  red?: boolean;
  onOpen: (el: Element) => void;
}) {
  return (
    <button type="button" className="glass panel mx-kpi3 ins-kpi" title={`Open the breakdown of ${label.toLowerCase()}`} onClick={(e) => onOpen(e.currentTarget)}>
      <span className="eyebrow">{label}</span>
      <span className="co-row">
        <b className={red ? 'red' : undefined}>{value}</b>
        {delta ? (
          <span className={'pill ' + delta.tone} title={delta.title}>
            {delta.text}
          </span>
        ) : null}
        <span className="sp" />
        {spark ? <MonthSpark {...spark} /> : null}
      </span>
      <span className="small">{note}</span>
    </button>
  );
}

/** Prototype mxSpark, drawn only from a real month-end series. */
function MonthSpark({ vals, tone, title }: { vals: number[]; tone: 'good' | 'ins-n'; title: string }) {
  if (vals.length < 2) return null;
  const W = 120;
  const H = 34;
  const mx = Math.max(...vals);
  const mn = Math.min(...vals);
  const x = (i: number) => (i * W) / (vals.length - 1);
  const y = (v: number) => H - 3 - ((v - mn) / (mx - mn || 1)) * (H - 6);
  const d = vals.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={'mx-spark ' + tone} role="img" aria-label={title}>
      <title>{title}</title>
      <path d={d} />
      <circle cx={x(vals.length - 1)} cy={y(vals[vals.length - 1]!)} r={3} />
    </svg>
  );
}

/* ---------------------------------------------------------------- monthly charts */

function FilingChart({
  kind,
  months,
  q,
  today,
  onOpenMonth,
}: {
  kind: 'rate' | 'delay';
  months: FilingMonth[];
  q: { isLoading: boolean; isError: boolean; refetch: () => unknown };
  today: string;
  onOpenMonth: (el: Element, m: FilingMonth) => void;
}) {
  const rate = kind === 'rate';
  const title = rate ? 'Compliance completion rate by month' : 'Average filing delay · days past due';
  const sub = rate ? 'Filings due each month that were filed by the due date' : 'Days past the due date per filing due that month · open filings count the days so far';
  const target = rate ? RATE_TARGET : DELAY_BENCHMARK;
  const any = months.some((m) => m.rows.length);
  return (
    <Panel title={title} sub={sub} need="cmp" act={<span className="pill mut">{rate ? `Target ${RATE_TARGET}%` : `Benchmark ${DELAY_BENCHMARK} days`}</span>}>
      {q.isLoading ? (
        <div className="sec-load">Loading the filings register…</div>
      ) : q.isError ? (
        <ErrorBox title="The filings register did not load" onRetry={() => void q.refetch()} />
      ) : !any ? (
        <EmptyNote icon="calc" title="No filings fell due in these months" sub="Filings show here once a client is incorporated and its compliance calendar is set up." />
      ) : (
        <>
          <TrendChart
            unit={rate ? '%' : 'd'}
            target={target}
            targetLabel={rate ? `${RATE_TARGET}% target` : `${DELAY_BENCHMARK}-day benchmark`}
            points={months.map((m) => {
              const v = rate ? m.rate : m.delay;
              const n = m.rows.length;
              return {
                label: m.short,
                v,
                tip:
                  v === null
                    ? `${m.label}: no filing fell due`
                    : rate
                      ? `${m.label}: ${v}% filed on time (${m.onTime} of ${n})`
                      : `${m.label}: ${v} days past due on average over ${plural(n, 'filing')}`,
                open: n ? (el: Element) => onOpenMonth(el, m) : undefined,
              };
            })}
            good={(v) => (rate ? v >= target : v < target)}
          />
          <div className="ins-cleg">
            <span>
              <i className="ins-pt good" />
              {rate ? 'Met the target' : 'Under the benchmark'}
            </span>
            <span>
              <i className="ins-pt" />
              {rate ? 'Below the target' : 'At or over the benchmark'}
            </span>
            <span>
              <i className="ins-dash" />
              {rate ? `${RATE_TARGET}% target` : `${DELAY_BENCHMARK}-day benchmark`}
            </span>
            <span className="ins-hint">{`Click a month for its filings · as of ${dWords(today, today)}`}</span>
          </div>
        </>
      )}
    </Panel>
  );
}

interface ChartPoint {
  label: string;
  v: number | null;
  tip: string;
  open?: (el: Element) => void;
}

/** The prototype's monthly line chart (`svg.mx-chart`), with gaps where nothing was due. */
function TrendChart({ points, unit, target, targetLabel, good }: { points: ChartPoint[]; unit: '%' | 'd'; target: number; targetLabel: string; good: (v: number) => boolean }) {
  const W = 560;
  const H = 200;
  const p = 36;
  const vals = points.map((x) => x.v).filter((v): v is number => v !== null);
  let min = 0;
  let max: number;
  if (unit === '%') {
    max = 100;
    min = Math.max(0, Math.min(80, Math.floor((Math.min(...vals, target) - 5) / 10) * 10));
  } else {
    const top = Math.max(...vals, target, 1) * 1.15;
    const step = top <= 5 ? 1 : top <= 10 ? 2 : top <= 25 ? 5 : 10;
    max = Math.ceil(top / step) * step;
  }
  const x = (i: number) => p + (i * (W - p * 2)) / Math.max(1, points.length - 1);
  const y = (v: number) => H - p - ((v - min) / (max - min || 1)) * (H - p * 2);
  const fmtV = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1)) + (unit === '%' ? '%' : '');
  /* runs of months with a value: one line and one shaded area each */
  const runs: number[][] = [];
  points.forEach((pt, i) => {
    if (pt.v === null) return;
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] === i - 1) last.push(i);
    else runs.push([i]);
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-chart" role="img" aria-label={`${targetLabel}. ${points.map((pt) => pt.tip).join('. ')}`}>
      {[0, 0.5, 1].map((g) => {
        const v = min + (max - min) * g;
        return (
          <g key={g}>
            <line x1={p} x2={W - p} y1={y(v)} y2={y(v)} className="mx-grid" />
            <text x={p - 8} y={y(v) + 4} className="mx-ax" textAnchor="end">
              {fmtV(v)}
            </text>
          </g>
        );
      })}
      <line x1={p} x2={W - p} y1={y(target)} y2={y(target)} className="mx-target" />
      <text x={W - p} y={y(target) - 6} className="mx-ax t" textAnchor="end">
        {targetLabel}
      </text>
      {runs.map((r) => {
        const d = r.map((i, k) => (k ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(points[i]!.v!).toFixed(1)).join(' ');
        return (
          <g key={r[0]}>
            {r.length > 1 ? <path d={`${d} L${x(r[r.length - 1]!).toFixed(1)} ${H - p} L${x(r[0]!).toFixed(1)} ${H - p} Z`} className="mx-area2" /> : null}
            {r.length > 1 ? <path d={d} className="mx-line" /> : null}
          </g>
        );
      })}
      {points.map((pt, i) => (
        <g key={pt.label + i}>
          <text x={x(i)} y={H - p + 18} className="mx-ax" textAnchor="middle">
            {pt.label}
          </text>
          {pt.v !== null ? (
            <g
              className={'ins-ptg' + (pt.open ? ' click' : '')}
              role={pt.open ? 'button' : undefined}
              tabIndex={pt.open ? 0 : undefined}
              aria-label={pt.tip}
              onClick={pt.open ? (e) => pt.open!(e.currentTarget) : undefined}
              onKeyDown={
                pt.open
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        pt.open!(e.currentTarget);
                      }
                    }
                  : undefined
              }
            >
              <title>{pt.tip}</title>
              <circle cx={x(i)} cy={y(pt.v)} r={12} className="ins-hit" />
              <circle cx={x(i)} cy={y(pt.v)} r={4.5} className={'mx-pt' + (good(pt.v) ? ' good' : '')} />
            </g>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

/* ---------------------------------------------------------------- by project lead (manager seat) */

function LeadScorecards() {
  const { model: m, loading } = useToday();
  const { base, go, openPop, openDrawer } = useConsole();
  const navHref = useNavHref();
  const cards = useMemo(() => leadCards(m, m.today), [m]);
  const leadsHref = navHref('leads', '/leads');
  const filingsHref = navHref('filings', '/compliances/filings');

  const openItem = (t: TItem) => {
    const c = m.byId[t.clientId];
    if (t.kind === 'task') openDrawer(<TeamItemDrawer itemId={t.id} />);
    else if (t.kind === 'step' && t.stepId && c) go(stepHref(base, c.e, t.stepId));
    else go(filingsHref);
  };
  const tRows = (list: TItem[]): DrillRow[] =>
    list.map((t) => ({ id: t.id, title: `${t.title} · ${m.byId[t.clientId]?.short ?? ''}`, meta: `${t.sub} · ${t.dueLabel}`, state: T_LABEL[t.st], color: T_COLOR[t.st], onOpen: () => openItem(t) }));

  const open = (el: Element, c: LeadCard, which: 0 | 1 | 2) => {
    const done: DrillRow[] = c.done.map((d) => {
      const cl = m.byId[d.clientId];
      return {
        id: d.id,
        title: `${d.title} · ${cl?.short ?? ''}`,
        meta: `${d.kind === 'step' ? 'Step' : 'Filing'} · done ${dWords(d.on, m.today)}${d.due ? ` · due ${dWords(d.due, m.today)}` : ' · no due date'}`,
        state: d.onTime === undefined ? 'No due date' : d.onTime ? 'On time' : 'Late',
        color: d.onTime === undefined ? 'var(--ink-3)' : d.onTime ? 'var(--mx-ok)' : 'var(--over)',
        onOpen: () => (d.kind === 'step' && d.stepId && cl ? go(stepHref(base, cl.e, d.stepId)) : go(filingsHref)),
      };
    });
    openPop(
      el,
      <Drill
        title={c.name}
        sub={`Project lead · last 14 days${c.rate === null ? '' : ` · ${c.rate}% on time`}`}
        tabs={[
          { label: 'Done', color: 'var(--mx-ok)', rows: done },
          { label: 'Open', rows: tRows(c.open) },
          { label: 'Overdue', color: 'var(--over)', rows: tRows(c.overdue) },
        ]}
        active={which}
        link={{ text: 'Open on Project leads', onClick: () => go(`${leadsHref}?lead=${encodeURIComponent(c.key)}`) }}
      />,
      { cls: 'mx-wide' },
    );
  };

  return (
    <>
      <div className="sec-h ins-sech2">
        <h2 className="mx-h3">By project lead</h2>
        <span className="small">Last 14 days · steps and filings their clients closed, and how many met the due date</span>
      </div>
      {loading ? (
        <div className="glass panel mx-p">
          <div className="sec-load">Loading your project leads…</div>
        </div>
      ) : !cards.length ? (
        <div className="glass panel mx-p">
          <EmptyNote icon="grid" title="No project leads on your clients yet" sub="A lead shows here once one is assigned to a client in your book." />
        </div>
      ) : (
        <>
          <div className="mx-scards">
            {cards.map((c) => (
              <div key={c.key} className="glass mx-scard" style={{ ['--lc' as string]: hueOf(c.key) }}>
                <button type="button" className="co-row ins-scl" title={`Open ${c.name} on Project leads`} onClick={() => go(`${leadsHref}?lead=${encodeURIComponent(c.key)}`)}>
                  <LeadAv id={c.key} name={c.name} initials={c.initials} />
                  <b className="ins-ell">{c.name}</b>
                  <span className="sp" />
                  {c.rate === null ? (
                    <span className="ins-ring0" title="No dated step or filing closed in the last 14 days">
                      —
                    </span>
                  ) : (
                    <Ring pct={c.rate} color={rateColor(c.rate)} size={44} title={`On time: ${c.onTime} of ${c.dated} (${c.rate}%)`} />
                  )}
                </button>
                <div className="mx-lpst">
                  <button type="button" title="Steps and filings closed in the last 14 days" onClick={(e) => open(e.currentTarget, c, 0)}>
                    <b>{c.done.length}</b>
                    <span>Done</span>
                  </button>
                  <button type="button" title="Open items now (Today's count)" onClick={(e) => open(e.currentTarget, c, 1)}>
                    <b>{c.open.length}</b>
                    <span>Open</span>
                  </button>
                  <button type="button" title="Open items past their date" onClick={(e) => open(e.currentTarget, c, 2)}>
                    <b className={c.overdue.length ? 'red' : undefined}>{c.overdue.length}</b>
                    <span>Overdue</span>
                  </button>
                </div>
                <span className="small">{c.rate === null ? 'Nothing dated closed in the last 14 days' : `On-time rate · ${c.onTime} of ${c.dated} met the due date`}</span>
              </div>
            ))}
          </div>
          <p className="small ins-legend">On-time rate ring: green 90% or more, amber 80 to 89%, red below 80%.</p>
        </>
      )}
    </>
  );
}
