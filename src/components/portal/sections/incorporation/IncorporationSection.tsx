'use client';

/**
 * INCORPORATION (prototype body.txt `#sec-incorporation`, a3_inc.js renderIncorporation /
 * renderStepDetail): four phase cards with a ring, the stepper of the selected phase and the
 * step detail (banner by state, plain description, what it needs, dates, actions).
 *
 * Real data: the step model (`usePortalIncorporation`, src/lib/client-portal/step-model.ts), the
 * file requests and board resolution (`useIncorporationExtras`) and this FY's filings (`useFilings`,
 * only to link a step that is one statutory filing to the calendar). The real gate is untouched:
 * a step's kind comes from the checklist state the client sees.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PortalPhase, PortalStep } from '@/lib/client-portal/step-model';
import { statusOf } from '@/lib/client-portal/compliances';
import { useIntent, useNavBadge, usePaletteItems, usePortal, type PaletteItem } from '../../runtime';
import { Btn, Icon, SecError, SecHead, SecLoading } from '../../ui';
import { daysTo, fmt, fmtL, todayIso } from '../../dates';
import { useFilings, useIncorporationExtras, usePortalIncorporation } from '../../data';
import {
  OWNER,
  PHASE_NAMES,
  PH_WAIT,
  SCOL,
  SST,
  STEP_FILING,
  isRegistrationStep,
  phaseInfo,
  protoOwner,
  protoState,
  resolveStepId,
  stepDescription,
  stepNeeds,
  stepTimeline,
  type ProtoState,
} from './model';
import { setIncSelection, useIncSelection } from './store';
import { useStepActions } from './actions';
import { StepWork, planStepWork, useRequestChange } from './StepWork';
import { StepWizard } from './StepWizard';
import '../../css/95-incorporation.css';

/* ---------------------------------------------------------------- ring (prototype ringSvg) */

function Ring({ pct, complete, col }: { pct: number; complete: boolean; col: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" className="rg" aria-hidden="true">
      <circle cx="29" cy="29" r={r} fill="none" style={{ stroke: 'var(--line)' }} strokeWidth="5" />
      <circle
        cx="29"
        cy="29"
        r={r}
        fill="none"
        style={{ stroke: col }}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${((c * pct) / 100).toFixed(1)} ${c.toFixed(1)}`}
        transform="rotate(-90 29 29)"
      />
      {complete ? (
        <path d="m20 29.5 6 6 12-12.5" fill="none" style={{ stroke: col }} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <text x="29" y="33.5" textAnchor="middle" style={{ fill: 'var(--ink)', font: '700 13px var(--f-disp)' }}>
          {pct}%
        </text>
      )}
    </svg>
  );
}

/* ---------------------------------------------------------------- state words */

function subLine(s: PortalStep, st: ProtoState): string {
  if (st === 'done') return s.doneOn ? `${SST.done} · ${fmt(s.doneOn)}` : SST.done;
  if (st === 'na') return SST.na;
  if (st === 'over') return `${SST.over}${s.due ? ` · was due ${fmt(s.due)}` : ''}`;
  if (s.kind === 'with') return `With ${s.owner === 'mca' ? 'MCA' : 'SBC'}${s.since ? ` · since ${fmt(s.since)}` : s.due ? ` · due ${fmt(s.due)}` : ''}`;
  if (st === 'you' || st === 'prog') return `${SST[st]}${s.due ? ` · due ${fmt(s.due)}` : ''}`;
  return `${SST.up}${s.due ? ` · planned ${fmt(s.due)}` : ''}`;
}

function NodeDot({ st, n, big }: { st: ProtoState; n: number; big?: boolean }) {
  return (
    <span className={'nd ' + st} style={big ? { width: 40, height: 40, fontSize: 14, flex: 'none' } : undefined}>
      {st === 'done' ? <Icon name="check" /> : st === 'over' ? '!' : String(n)}
    </span>
  );
}

/* ---------------------------------------------------------------- step detail */

function StepDetail({ s }: { s: PortalStep }) {
  const { openChat, setIntent, go, shell } = usePortal();
  const { openStepWizard } = useStepActions();
  const requestChange = useRequestChange();
  const extras = useIncorporationExtras();
  const { engagement } = usePortalIncorporation();
  const filings = useFilings();
  const st = protoState(s);
  const own = protoOwner(s);
  const short = shell?.companyShort || 'your company';
  const plan = planStepWork(s, extras.data, Boolean(engagement));
  const openReqs = (extras.data?.fileRequests ?? []).filter((r) => r.stepId === s.id && !r.fulfilledAt);
  const today = todayIso();

  const fil = useMemo(() => {
    const re = STEP_FILING[s.id];
    if (!re) return undefined;
    return (filings.data?.rows ?? []).find((f) => re.test(f.name) || re.test(f.particular));
  }, [s.id, filings.data]);
  const fst = fil ? statusOf(fil, filings.data?.today ?? today) : null;

  const holder = s.owner === 'mca' ? 'MCA' : s.owner === 'client' ? short : 'SBC';
  const youWhy = plan.approve
    ? `${short}’s team filled this step. Check it, then approve & submit${s.due ? ` by ${fmt(s.due)}` : ''}.`
    : openReqs.length
      ? `Upload: ${openReqs.map((r) => r.label).join(', ')}${s.due ? ` · due ${fmt(s.due)}` : ''}`
      : `Fill this step${s.due ? ` and submit by ${fmt(s.due)}` : ''}.`;
  const BAN: Record<ProtoState, [string, 'check' | 'alert' | 'clock', string, string]> = {
    done: ['ok', 'check', 'Complete', s.doneOn ? `Done on ${fmtL(s.doneOn)}` : ''],
    over: ['over', 'alert', 'Overdue', `${s.due ? `Was due ${fmt(s.due)} · ${s.lateDays} day${s.lateDays === 1 ? '' : 's'} late` : 'Past its window'} · with ${holder}${s.kind === 'you' ? ` · ${youWhy}` : ''}`],
    you: ['due', 'clock', 'Waiting on you', youWhy],
    prog:
      s.kind === 'with'
        ? ['info', 'clock', `With ${s.owner === 'mca' ? 'MCA' : 'SBC'}`, [s.since ? `Since ${fmt(s.since)}` : '', s.due ? `due ${fmt(s.due)}` : ''].filter(Boolean).join(' · ') || 'SBC is working on it']
        : ['info', 'clock', 'In progress', `You have started this step${s.due ? ` · submit by ${fmt(s.due)}` : ''}.`],
    up: ['info', 'clock', 'Queued', s.due ? `Planned by ${fmtL(s.due)} · opens once the steps before it are done` : 'Opens once the steps before it are done'],
    na: ['info', 'check', 'Not needed', 'This step does not apply to your company.'],
  };
  const b = BAN[st];
  const desc = stepDescription(s.item);
  const needs = stepNeeds(s.item);
  const timeline = stepTimeline(s.item);
  const embed = plan.uploads > 0 || plan.approve || plan.board;

  return (
    <div className="fadein">
      <div className="sd-h">
        <NodeDot st={st} n={s.n} big />
        <div style={{ flex: 1, minWidth: 180 }}>
          <span className="eyebrow">
            {PHASE_NAMES[s.phaseNo - 1]} · step {s.n}
          </span>
          <h3>{s.title}</h3>
        </div>
        {fil && fst ? (
          <button
            type="button"
            className={'calchip ' + (fst === 'over' ? 'over' : fst === 'due' ? 'due' : '')}
            title="Show in the calendar"
            onClick={() => setIntent({ kind: 'filing', id: fil.id })}
          >
            <Icon name="cal" />
            {fst === 'over' ? 'Was due' : fst === 'ok' ? 'Filed' : 'Due'} {fmt(fil.filedOn ?? fil.dueDate)}
            {fst === 'over' ? ` · ${-daysTo(fil.dueDate, today)}d late` : ''}
          </button>
        ) : s.due && st !== 'done' && st !== 'na' ? (
          <span className={'calchip ' + (st === 'over' ? 'over' : st === 'you' ? 'due' : '')} title={s.windowFrom ? `Window ${fmt(s.windowFrom)} – ${fmt(s.due)}` : undefined}>
            <Icon name="cal" />
            {st === 'over' ? 'Was due' : 'Due'} {fmt(s.due)}
          </span>
        ) : null}
        <span className="pill mut">{OWNER[own]}</span>
      </div>
      <div className={'banner ' + b[0]}>
        <Icon name={b[1]} />
        <div>
          <b>{b[2]}</b>
          {b[3] ? <span>{b[3]}</span> : null}
        </div>
      </div>
      {s.item.forms.length || timeline ? (
        <div className="sd-facts">
          {s.item.forms.map((x) => (
            <span key={x} className="pill mut">
              {x}
            </span>
          ))}
          {timeline ? <span className="pill mut">{timeline}</span> : null}
        </div>
      ) : null}
      {desc ? <p className="sd-desc">{desc}</p> : null}
      {needs.length ? (
        <div className="caps">
          {needs.map((k) => (
            <div key={k} className="cap">
              <div style={{ fontWeight: 600 }}>{k}</div>
              <span className={'v' + (st === 'done' ? ' y' : '')}>{st === 'done' ? `Provided${s.doneOn ? ` · ${fmt(s.doneOn)}` : ''}` : st === 'na' ? '—' : 'Pending'}</span>
            </div>
          ))}
        </div>
      ) : null}
      {embed ? (
        <div className="sd-work">
          <StepWork stepId={s.id} />
        </div>
      ) : null}
      <div className="sd-acts">
        <Btn cls="pri" ico="step" onClick={() => openStepWizard(s.id)}>
          {plan.form ? 'Fill this step' : 'Step by step'}
        </Btn>
        {s.kind === 'done' && !embed ? (
          <Btn ico="send" onClick={() => requestChange(s)}>
            Request a change
          </Btn>
        ) : null}
        <Btn ico="chat" onClick={() => openChat(`What is ${s.title}?`)}>
          Ask VCFO
        </Btn>
        {isRegistrationStep(s.id) ? (
          <Btn ico="key" onClick={() => go('registrations')}>
            Open Registrations
          </Btn>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- section */

export function IncorporationSection() {
  const { go, openWizard } = usePortal();
  const { model, engagement, loading } = usePortalIncorporation();
  const { showStep, openStepWizard } = useStepActions();
  const sel = useIncSelection();
  // The checklist state arrives after the engagement list: wait for it (or 2.5 s for a project with no state yet).
  const hasState = model.steps.some((x) => x.slice);
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (loading || !engagement) return;
    const t = window.setTimeout(() => setWaited(true), 2500);
    return () => window.clearTimeout(t);
  }, [loading, engagement]);
  const ready = !loading && Boolean(engagement) && (hasState || waited);

  /* default selection: the phase with the current step (prototype selPhase), phases 1–3 */
  const curPhase = useMemo(() => {
    const p = model.phases.slice(0, 3).find((x) => x.state === 'active') ?? model.phases.slice(0, 3).find((x) => x.state !== 'done');
    return p?.no ?? 3;
  }, [model.phases]);
  const phaseNo = sel.phaseNo && sel.phaseNo <= 3 ? sel.phaseNo : curPhase;
  const phase: PortalPhase | undefined = model.phases[phaseNo - 1];
  const f = phase ? phaseInfo(phase) : undefined;
  const selStepId = sel.stepId && model.byId[sel.stepId]?.phaseNo === phaseNo ? sel.stepId : (f?.cur ?? phase?.steps.at(-1))?.id;
  const step = selStepId ? model.byId[selStepId] : undefined;

  /* nav badge (prototype nb-steps) */
  useNavBadge('incorporation', model.steps.length ? `${model.all.done}/${model.all.total}` : undefined);

  /* search palette: every step → showStep */
  const palette: PaletteItem[] = useMemo(
    () =>
      model.steps.map((s) => {
        const st = protoState(s);
        return {
          id: `step:${s.id}`,
          label: s.title,
          kind: `${PHASE_NAMES[s.phaseNo - 1]} · ${SST[st]}`,
          sw: SCOL[st],
          go: () => showStep(s.id),
        };
      }),
    [model.steps, showStep],
  );
  usePaletteItems('incorporation', palette);

  /* route intents: /incorporation/step/:id, /incorporation/phase/:n, /board-resolution */
  useIntent(['step', 'phase', 'board'], ready && model.steps.length > 0, (i) => {
    if (i.kind === 'step') {
      const id = resolveStepId(i.stepId);
      if (!id) {
        go('incorporation');
        return;
      }
      showStep(id);
      openStepWizard(id);
    } else if (i.kind === 'phase') {
      if (i.phaseNo >= 4) {
        go('registrations');
        return;
      }
      const p = model.phases[i.phaseNo - 1];
      setIncSelection({ phaseNo: i.phaseNo, stepId: null }, true);
      window.setTimeout(() => go('incorporation'), 30);
      if (p) openWizard(<StepWizard phaseNo={i.phaseNo} stepId={p.currentStepId} />);
    } else {
      const s2 = model.byId['pre-2'];
      const id = s2 && s2.kind !== 'done' ? 'pre-2' : 'pre-3';
      showStep(id);
      openStepWizard(id);
    }
  });

  /* scroll the selected stepper row into view inside its own scroller */
  const stepperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = stepperRef.current;
    const row = box?.querySelector<HTMLElement>('.sr.sel');
    if (box && row) {
      const top = row.offsetTop - box.offsetTop;
      if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - row.offsetHeight) box.scrollTop = Math.max(0, top - 40);
    }
  }, [selStepId, sel.seq]);

  if (loading && !model.steps.length) {
    return (
      <>
        <SecHead title="Incorporation" />
        <SecLoading />
      </>
    );
  }
  if (!engagement) {
    return (
      <>
        <SecHead title="Incorporation" />
        <SecError message="No incorporation project is linked to your account yet." />
      </>
    );
  }

  const inc = model.steps.filter((s) => s.phaseNo < 4);
  const incApp = inc.filter((s) => protoState(s) !== 'na');
  const head = `Steps 1 – ${inc.length} · ${incApp.filter((s) => s.kind === 'done').length} of ${incApp.length} done`;

  return (
    <>
      <SecHead title="Incorporation" count={head} />
      <div className="phases">
        {model.phases.map((p) => {
          const pf = phaseInfo(p);
          const reg = p.no === 4;
          const col = pf.status === 'Complete' ? 'var(--ok-green)' : pf.status === 'In progress' ? 'var(--ice)' : 'var(--ink-3)';
          const last = [...p.steps].reverse().find((s) => s.doneOn);
          let cur: ReactNode;
          if (reg) cur = 'Open Registrations ↓';
          else if (pf.cur) cur = `Now: ${pf.cur.title}`;
          else if (pf.status === 'Complete') cur = last?.doneOn ? `Completed ${fmt(last.doneOn)}` : 'Completed';
          else cur = PH_WAIT[p.no - 1] || 'Not started';
          return (
            <button
              key={p.id}
              type="button"
              className={'glass pc' + (reg ? ' reg' : '') + (!reg && phaseNo === p.no ? ' sel' : '')}
              style={{ ['--pc' as string]: col }}
              aria-pressed={!reg && phaseNo === p.no}
              onClick={() => {
                if (reg) {
                  go('registrations');
                  return;
                }
                setIncSelection({ phaseNo: p.no, stepId: null });
              }}
            >
              <Ring pct={pf.pct} complete={pf.status === 'Complete'} col={col} />
              <div className="cnt">
                <b>
                  {pf.done}
                  <small>/{pf.app.length}</small>
                </b>
                <span>STEPS</span>
              </div>
              <h3>{PHASE_NAMES[p.no - 1]}</h3>
              <div className="st">
                <span className={'pill ' + (pf.status === 'Complete' ? 'ok' : pf.status === 'In progress' ? 'up' : 'mut')}>{pf.status}</span>
                {p.steps.some((s) => s.late) ? <span className="pill over">{p.steps.filter((s) => s.late).length} late</span> : null}
              </div>
              <div className="cur">{cur}</div>
            </button>
          );
        })}
      </div>
      <div className="inc">
        <section className="glass panel" id="stepdetail" aria-label="Step detail">
          {step ? <StepDetail key={step.id} s={step} /> : <div className="sec-empty">Pick a step to see what it needs.</div>}
        </section>
        <section className="glass panel" aria-label={phase ? `${PHASE_NAMES[phaseNo - 1]} steps` : 'Steps'}>
          <div className="ph">
            <span className="eyebrow">
              {PHASE_NAMES[phaseNo - 1]} · {phase?.steps.length ?? 0} steps
            </span>
            <span className="sp" />
            <span className="small">{f?.done ?? 0} done</span>
          </div>
          <div className="stepper" ref={stepperRef}>
            {phase?.steps.map((s) => {
              const st = protoState(s);
              const own = protoOwner(s);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={'sr ' + (st === 'done' ? 'done' : '') + (s.id === selStepId ? ' sel' : '')}
                  aria-current={s.id === selStepId ? 'step' : undefined}
                  onClick={() => setIncSelection({ phaseNo, stepId: s.id })}
                >
                  <NodeDot st={st} n={s.n} />
                  <div style={{ minWidth: 0 }}>
                    <div className="nm">
                      {s.n} · {s.title}
                    </div>
                    <div className="sb">{subLine(s, st)}</div>
                  </div>
                  <span className={'ow' + (own === 'you' && st !== 'done' ? ' you' : '')}>{OWNER[own].toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
