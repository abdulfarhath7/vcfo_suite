'use client';

/**
 * Home (prototype body.txt HOME + a2_home.js renderHome): the company strip,
 * the year in orbit, and the right column — Today (headline + four KPIs),
 * Your dock (everything waiting on the client) and the Next deadline countdown.
 *
 * Data: useFilings() (this FY's register), useClientHome() (open requests,
 * identifiers, filing owners), usePortalIncorporation() (step model),
 * useClientOverview() (entity, office, parent) and the shell (company, team, me).
 */
import { useCallback, useMemo, useRef } from 'react';
import { statusOf, type PortalFiling } from '@/lib/client-portal/compliances';
import { filingTrack, hasTrack, whoActs } from '@/lib/client-portal/filing-track';
import { usePaletteItems, usePortal, type PaletteItem } from '../../runtime';
import { useClientHome, useClientOverview, useFilings, usePortalIncorporation } from '../../data';
import { daysTo, fmtL, fmtY, fyOf, todayIso } from '../../dates';
import { Btn, Icon, LawChip, SecError, SecLoading, Timer } from '../../ui';
import { useFilingActions } from '../filings/actions';
import { useStepActions } from '../incorporation/actions';
import { useDocActions } from '../documents/actions';
import { Orbit } from './Orbit';
import { buildDock, companySubLine, firstName, greeting, nextDeadlineOf, overdueOf, readyBy, shortName, stageLabel, type DockItem } from './model';
import '../../css/95-home.css';

const EMPTY: PortalFiling[] = [];

/**
 * Every list Home reads, in one place (the brief reads the same):
 *  - `rows`  this financial year's register (the orbit, "filed this year");
 *  - `all`   the whole register, every year (overdue, the next deadline, the dock),
 *            so a filing missed last March does not vanish in April.
 * Both queries are the ones Calendar / Filings already make (shared keys).
 */
export function useHomeData() {
  const { shell } = usePortal();
  const fy = fyOf(todayIso());
  const fyQ = useFilings(fy.start);
  const allQ = useFilings();
  const homeQ = useClientHome();
  const { model, loading: stepsLoading } = usePortalIncorporation();
  const today = fyQ.data?.today ?? allQ.data?.today ?? todayIso();
  const rows = fyQ.data?.rows ?? EMPTY;
  const all = allQ.data?.rows ?? rows;
  const home = homeQ.data ?? null;
  const dock = useMemo(() => buildDock(model, home, all, today), [model, home, all, today]);
  return {
    shell,
    rows,
    all,
    home,
    model,
    today,
    dock,
    loading: fyQ.isPending || homeQ.isPending || stepsLoading,
    error: fyQ.error ?? homeQ.error ?? null,
    refetch: () => {
      void fyQ.refetch();
      void allQ.refetch();
      void homeQ.refetch();
    },
  };
}

/** Opens the right thing for a dock item (step walkthrough, the upload, the filing walkthrough). */
export function useOpenDockItem(rows: PortalFiling[]): (x: DockItem) => void {
  const { openStepWizard } = useStepActions();
  const { focusUpload } = useDocActions();
  const { openFilingWizard } = useFilingActions();
  const { toast } = usePortal();
  return useCallback(
    (x: DockItem) => {
      const o = x.open;
      if (o.kind === 'step') return openStepWizard(o.stepId);
      if (o.kind === 'request') return focusUpload({ requestId: o.requestId, stepId: o.stepId });
      const f = rows.find((r) => r.id === o.filingId);
      if (f) return openFilingWizard(f);
      toast('That filing is no longer on this year’s register');
    },
    [openStepWizard, focusUpload, openFilingWizard, rows, toast],
  );
}

export function HomeSection() {
  const { go } = usePortal();
  const { shell, rows, all, home, model, today, dock, loading, error, refetch } = useHomeData();
  const overviewQ = useClientOverview();
  const eng = overviewQ.data?.overview?.engagement;
  const { openFiling, openFilingWizard } = useFilingActions();
  const openItem = useOpenDockItem(all);
  const dockRef = useRef<HTMLElement>(null);

  const over = useMemo(() => overdueOf(all, today), [all, today]);
  const filedN = useMemo(() => rows.filter((r) => Boolean(r.filedOn)).length, [rows]);
  const next = useMemo(() => nextDeadlineOf(all, today), [all, today]);
  const fy = fyOf(today);

  const focusDock = useCallback(() => {
    const d = dockRef.current;
    if (!d) return;
    d.scrollIntoView({ block: 'center', behavior: 'smooth' });
    d.classList.remove('flash');
    void d.offsetWidth;
    d.classList.add('flash');
  }, []);

  const palette = useMemo<PaletteItem[]>(
    () =>
      dock.map((x) => ({
        id: `dock:${x.key}`,
        label: x.title,
        kind: 'Waiting on you',
        sw: 'var(--due)',
        go: () => openItem(x),
      })),
    [dock, openItem],
  );
  usePaletteItems('home', palette);

  const companyName = shell?.companyName ?? eng?.companyName ?? '';
  const sub = companySubLine(eng);
  const stage = stageLabel(model);
  const ready = readyBy(model, today);
  const ids = home?.identifiers;
  const me = firstName(shell?.me.name);

  return (
    <>
      <div className="glass co-strip">
        <div className="co-row">
          <span className="eyebrow">Client portal · {fy.label}</span>
          <span className="sp" />
          {over.length ? (
            <button type="button" className="idc red" id="h-over" onClick={() => go('calendar')} title="Open the calendar">
              <span>OVERDUE</span>
              <b>
                {over.length} · {over[0]!.name}
              </b>
            </button>
          ) : null}
        </div>
        <h1>{companyName || '—'}</h1>
        {sub ? <div className="sub2">{sub}</div> : null}
        <div className="chips">
          {ids?.cin ? (
            <span className="idc">
              <span>CIN</span>
              <b id="h-cin">{ids.cin}</b>
            </span>
          ) : null}
          {ids?.gstin ? (
            <span className="idc">
              <span>GSTIN</span>
              <b id="h-gst">{ids.gstin}</b>
            </span>
          ) : null}
          {stage ? (
            <span className="idc">
              <span>STAGE</span>
              <b style={{ fontFamily: 'var(--f-disp)', fontWeight: 600 }}>{stage}</b>
            </span>
          ) : null}
          {ready ? (
            <span className="idc">
              <span>READY BY</span>
              <b style={{ fontFamily: 'var(--f-disp)', fontWeight: 600 }}>{fmtY(ready)}</b>
            </span>
          ) : null}
        </div>
      </div>

      {error && !rows.length ? <SecError message={error.message} onRetry={refetch} /> : null}

      <div className="home">
        <section className="glass orbit-card" aria-label="The year in orbit">
          {loading && !rows.length ? <SecLoading /> : <Orbit rows={rows} today={today} model={model} dockCount={dock.length} onDock={focusDock} />}
        </section>

        <div className="rcol">
          <section className="glass today">
            <span className="eyebrow" id="t-date">
              {fmtL(today)}
              {me ? ` · ${greeting()}, ${me}` : ''}
            </span>
            <h2 id="t-head">
              {over.length ? <span className="r">{over.length === 1 ? '1 filing is overdue.' : `${over.length} filings are overdue.`}</span> : <span>Nothing is overdue.</span>}
              {dock.length ? <span className="a">{dock.length === 1 ? '1 paper waits on you.' : `${dock.length} papers wait on you.`}</span> : <span>Nothing waits on you.</span>}
            </h2>
            <div className="kpis">
              <button type="button" className="kpi" onClick={() => go('incorporation')}>
                <b id="k1">
                  {model.all.done}
                  <small>/{model.all.total}</small>
                </b>
                <span>steps built</span>
              </button>
              <button type="button" className="kpi r" onClick={() => go('calendar')}>
                <b id="k2">{over.length}</b>
                <span>overdue</span>
              </button>
              <button type="button" className="kpi a" id="k3b" onClick={focusDock}>
                <b id="k3">{dock.length}</b>
                <span>waiting on you</span>
              </button>
              <button type="button" className="kpi" onClick={() => go('filings')}>
                <b id="k4">{filedN}</b>
                <span>filed this year</span>
              </button>
            </div>
          </section>

          <section className="glass dock" aria-label="Your dock" ref={dockRef}>
            <div className="ph" style={{ marginBottom: 2 }}>
              <h3>Your dock</h3>
              <span className="sp" />
              <span className={'pill ' + (dock.length ? 'due' : 'ok')} id="dockct">
                {dock.length ? `${dock.length} waiting` : 'All clear'}
              </span>
            </div>
            <div id="holds">
              {dock.length ? (
                dock.map((x) => (
                  <button key={x.key} type="button" className={'hold' + (x.sev === 'over' ? ' over' : '')} onClick={() => openItem(x)}>
                    <i />
                    <b>{x.title}</b>
                    <span className="go">Do it</span>
                    <span className="t">{x.tag}</span>
                  </button>
                ))
              ) : (
                <p className="lede" style={{ marginTop: 10 }}>
                  Nothing is waiting on you. SBC has every open item.
                </p>
              )}
            </div>
          </section>

          <section className="glass cd" aria-label="Countdown">
            <div className="ph" style={{ marginBottom: 0 }}>
              <span className="eyebrow">{next ? 'Next deadline' : over.length ? 'Overdue' : 'Next deadline'}</span>
              <span className="sp" />
              <span id="cd-law">{next ? <LawChip law={next.area} /> : over[0] ? <LawChip law={over[0].area} /> : null}</span>
            </div>
            <div id="cd">
              {next ? (
                <Countdown f={next} today={today} companyShort={shell?.companyShort ?? 'You'} onOpen={(el) => openFiling(next, el)} onSteps={() => openFilingWizard(next)} />
              ) : over[0] ? (
                <Countdown f={over[0]} today={today} companyShort={shell?.companyShort ?? 'You'} since onOpen={(el) => openFiling(over[0]!, el)} onSteps={() => openFilingWizard(over[0]!)} />
              ) : (
                <p className="lede" style={{ marginTop: 10 }}>
                  No deadline on the register for {fy.label} yet.
                </p>
              )}
              {next && over[0] ? (
                <button type="button" className="late" onClick={(e) => openFiling(over[0]!, e.currentTarget)}>
                  <Icon name="alert" size={16} />
                  {shortName(over[0].name)} overdue
                  <span className="tm">{-daysTo(over[0].dueDate, today)} days late</span>
                </button>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

/** The countdown card body: title, when, live timer, SBC preparation (from recorded dates), actions. */
function Countdown({
  f,
  today,
  companyShort,
  since,
  onOpen,
  onSteps,
}: {
  f: PortalFiling;
  today: string;
  companyShort: string;
  /** count up from the missed due date instead of down to it */
  since?: boolean;
  onOpen: (el: HTMLElement) => void;
  onSteps: () => void;
}) {
  const track = useMemo(() => filingTrack(f, companyShort, today), [f, companyShort, today]);
  const doneN = track.filter((s) => s.state === 'done').length;
  const pct = Math.round((doneN / track.length) * 100);
  const who = whoActs(f, track);
  const st = statusOf(f, today);
  return (
    <>
      <div className="tt">
        {f.name}
        {f.period ? ` · ${f.period}` : ''}
      </div>
      <div className="wh">
        {fmtL(f.dueDate)} · 11:59 pm IST · {since ? `${-daysTo(f.dueDate, today)} days late · ${who}` : who === 'SBC' ? 'SBC files it' : who}
      </div>
      <Timer due={f.dueDate} mode={since ? 'since' : 'to'} />
      {hasTrack(f) && st !== 'ok' ? (
        <div className="prep">
          <div className="row">
            <span>SBC preparation</span>
            <span>{pct}% ready</span>
          </div>
          <div className="bar">
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Btn cls="sm" ico="doc" onClick={(e) => onOpen(e.currentTarget)}>
          Open the filing
        </Btn>
        <Btn cls="sm" ico="step" onClick={onSteps}>
          Step by step
        </Btn>
      </div>
    </>
  );
}
