'use client';

/**
 * PHASE PAGE — `/app/client/incorporation/phase/[n]` (FINAL phase.html#p=1..4,
 * `renderPhase`): navy hero, Progress card, Steps table, Focus-track journey
 * rail, "Who's doing it", phone prev/next.
 */
import { useMemo, useState } from 'react';
import type { PortalPhase, PortalStep } from '@/lib/client-portal/step-model';
import { phaseHref, portalHref } from '../../routes';
import { usePortal, usePortalCrumbs } from '../../PortalProvider';
import { useDocViewer, type ViewerDoc } from '../documents/DocViewer';
import { Bmini, BotSay, Ic, IncFrame, InfoBtn, Own, Si, days, fmt, fmtY } from './ui';
import {
  PH,
  PHL,
  phInfo,
  phWhy,
  PH_SRC,
  kd,
  glyph,
  idx,
  ownKey,
  phDoneEnd,
  phPlan,
  phaseAnswer,
  railSub,
  stRow,
  stepAnswer,
  stepHrefOf,
  subList,
  tabsFor,
  tipTxt,
  useIncData,
  type IncData,
} from './data';
import { StepTable } from './StepTable';
import { RingSvg } from './Landing';

export function PhaseBar({ p, plan, doneEnd, onClick }: { p: PortalPhase; plan: [string, string] | null; doneEnd?: string; onClick: () => void }) {
  const cls = p.state === 'done' ? 's-done' : p.state === 'up' ? 's-up' : 's-active';
  const fill = p.state === 'done' ? 100 : Math.round((p.done / p.total) * 100);
  let late: React.ReactNode = null;
  if (p.state === 'done' && plan && doneEnd && doneEnd > plan[1]) {
    const lp = ((Date.parse(doneEnd) - Date.parse(plan[1])) / Math.max(864e5, Date.parse(doneEnd) - Date.parse(plan[0]))) * 100;
    late = <i className="lt" style={{ width: `${lp.toFixed(1)}%` }} />;
  }
  const tip = `${PHL[p.no - 1]} · ${p.done} of ${p.total} done${plan ? ` · ${fmt(plan[0])} → ${fmt(plan[1])}` : ''}`;
  return (
    <button type="button" className={`gbar ${cls}`} aria-label={tip} data-tt={tip} data-notip="" onClick={onClick}>
      <span className="in">
        <i className="f" style={{ width: `${fill}%` }} />
        {late}
      </span>
      {p.no === 2 ? <i className="ms" /> : null}
    </button>
  );
}

function RailHero({ x, d, isPage }: { x: PortalStep; d: IncData; isPage: boolean }) {
  const { openChat } = usePortal();
  const k = kd(x);
  const sl = subList(x);
  const dn = sl.filter((s) => s.s === 'done').length;
  const lbl = `${isPage ? (k === 'done' ? 'Done' : k === 'up' ? 'Upcoming' : 'Now') : 'Now'} · step ${x.n}`;
  const labels = sl.length <= 4 && sl.every((s) => s.l.length <= 14);
  const sub = railSub(x, d.short);
  const st = (s: string) => (s === 'done' ? 'done' : s === 'now' ? 'in progress' : 'to do');
  return (
    <div className="rh" role="group" aria-label={`Step ${x.n} · ${x.title} · ${sub}`}>
      <div className="hh">
        <Si k={glyph(x)} tip={tipTxt(x)} />
        <div style={{ minWidth: 0 }}>
          <div className="k">{lbl}</div>
          <b>{x.title}</b>
          <small>{sub}</small>
        </div>
        <button
          type="button"
          className="wq"
          aria-label={`What’s this? ${x.title}`}
          data-tt="What’s this? · ask VCFO"
          data-notip=""
          onClick={() => openChat(`What’s this: ${x.title}?`, stepAnswer(x, d.short))}
        >
          <Ic n="circle-help" />
        </button>
      </div>
      <div className="subt">
        {sl.map((s, i) => (
          <span
            key={`${s.l}-${i}`}
            className={`sb ${s.s === 'done' ? 'on' : s.s === 'now' ? 'cu' : ''}`}
            role="img"
            aria-label={`${s.l} · ${st(s.s)}`}
            data-tt={`${s.l} · ${st(s.s)}`}
          >
            <i />
            {labels ? <span>{s.l}</span> : null}
          </span>
        ))}
      </div>
      {labels ? null : (
        <div className="subn">
          {dn} of {sl.length} sub-steps done
        </div>
      )}
    </div>
  );
}

export function JourneyRail({ p, focus, d, isPage }: { p: PortalPhase; focus: string; d: IncData; isPage: boolean }) {
  const { go } = usePortal();
  const [all, setAll] = useState(false);
  const l = p.steps;
  let list = l;
  if (l.length > 11 && !all) {
    const i = l.findIndex((x) => x.id === focus);
    const s = Math.max(0, Math.min(l.length - 9, i - 4));
    list = l.slice(s, s + 9);
  }
  return (
    <section className="card acc rail" aria-label={`Journey · Phase ${p.no}`}>
      <div className="ch">
        <h2 className="lbl" style={{ fontSize: '11.5px' }}>
          {PH[p.no - 1]} · journey
        </h2>
        <span className="sp" />
        <span className="chip up" style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
          {p.done} / {l.length}
        </span>
      </div>
      <div className="rl">
        {list.map((x, j) => {
          if (x.id === focus) return <RailHero key={x.id} x={x} d={d} isPage={isPage} />;
          const k = kd(x);
          const nx = list[j + 1];
          const ok = k === 'done' && nx && kd(nx) === 'done';
          const sub = railSub(x, d.short);
          const sl = k === 'done' || k === 'up' ? null : subList(x).slice(0, 6);
          return (
            <a
              key={x.id}
              href={stepHrefOf(x)}
              className={`rr${ok ? ' ok' : ''}${j === list.length - 1 ? ' last' : ''}`}
              aria-label={`Step ${x.n} · ${x.title} · ${sub}`}
              onClick={(e) => {
                e.preventDefault();
                go(stepHrefOf(x));
              }}
            >
              <Si k={glyph(x)} tip={tipTxt(x)} />
              <span style={{ minWidth: 0 }}>
                <b>
                  {x.n} · {x.title}
                </b>
                <small>{sub}</small>
                {sl ? (
                  <span className="dots" aria-hidden="true">
                    {sl.map((s, i) => (
                      <i key={i} className={s.s === 'done' ? 'on' : s.s === 'now' ? 'cu' : ''} />
                    ))}
                  </span>
                ) : null}
              </span>
              <Own o={ownKey(x)} short={d.short} />
            </a>
          );
        })}
      </div>
      {l.length > 11 ? (
        <button type="button" className="btn sm rmore" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer steps' : `Show all ${l.length} steps`}
        </button>
      ) : null}
    </section>
  );
}

export default function PhasePage({ phaseNo }: { phaseNo: number }) {
  const d = useIncData();
  const { go, drill, openChat } = usePortal();
  const viewer = useDocViewer();
  const p = d.model.phases[Math.min(4, Math.max(1, phaseNo)) - 1];
  const i = (p?.no ?? 1) - 1;
  usePortalCrumbs(['Incorporation', p ? `Phase ${p.no} · ${p.name}` : 'Phase']);
  const coi = d.coiDate ?? d.coiExpected;
  const plan = p ? phPlan(p, coi) : null;
  const doneEnd = p ? phDoneEnd(p) : undefined;
  const endD = p?.state === 'done' ? doneEnd ?? plan?.[1] : plan?.[1];
  const focusStep = useMemo(() => {
    if (!p) return undefined;
    return p.steps.find((x) => kd(x) === 'you') ?? p.steps.find((x) => kd(x) !== 'done') ?? p.steps.at(-1);
  }, [p]);

  if (!p) return null;
  const pct = Math.round((p.done / p.total) * 100);
  const title = `Phase ${p.no} · ${PH[i]}`;
  const ans = phaseAnswer(p, d.short, phaseHref(p.no));
  const drillPhase = () => {
    const tabs = tabsFor(p.steps, d.coiExpected);
    const c = (k: string) => p.steps.some((x) => kd(x) === k);
    const act = c('you') ? 'you' : c('with') ? 'with' : c('prog') ? 'prog' : p.done === p.total ? 'done' : 'up';
    drill({ title, sub: `${p.done} of ${p.total} steps done`, tabs, active: idx(tabs, act) });
  };
  const O: Array<[string, PortalStep[], string, string]> = [
    [d.short, p.steps.filter((x) => ownKey(x) === 'You'), '#c9a24b', 'You'],
    ['SBC', p.steps.filter((x) => ownKey(x) === 'SBC'), '#2f6fd0', 'SBC'],
    ['MCA', p.steps.filter((x) => ownKey(x) === 'MCA'), '#6b3fc4', 'MCA'],
  ];
  const drillOwner = (o: string) => {
    const tabs = O.filter((x) => x[1].length).map((x) => ({ k: x[3], label: x[0], color: x[2], rows: x[1].map((s) => stRow(s, d.coiExpected)) }));
    drill({ title: `Who’s doing it · Phase ${p.no}`, sub: `${PH[i]} · ${p.total} steps`, tabs, active: idx(tabs, o) });
  };
  const curNow = p.state !== 'done' ? focusStep : undefined;

  return (
    <IncFrame pending={d.pending} title={`${title} · Incorporation · VCFO Suite`}>
      <div className="wrap">
        <section className="hero" aria-label={title}>
          <div className="hrow">
            <div className="hl">
              <button type="button" className="hback" aria-label="Back to Incorporation" onClick={() => go(portalHref('incorporation'))}>
                <Ic n="chevron-left" />
              </button>
              <div className="htx">
                <div className="eb">Incorporation · phase {p.no} of 4</div>
                <div className="ht">
                  <h1>{PH[i]}</h1>
                  <button
                    type="button"
                    className="wt"
                    aria-label={`What’s this? ${title}`}
                    data-tt="What’s this? · ask VCFO"
                    data-notip=""
                    onClick={() => openChat(`What’s this: ${title}?`, ans)}
                  >
                    <Bmini />
                    What’s this?
                  </button>
                </div>
                <div className="hm">
                  {p.done}/{p.total}
                  {plan ? ` · ${fmt(plan[0])} → ${fmt(endD)} · ${p.state === 'done' ? 'finished ' : 'ends '}${fmtY(endD)}` : ''}
                </div>
              </div>
            </div>
            <div className="hr">
              <div className="hnav">
                {p.no > 1 ? (
                  <a
                    href={phaseHref(p.no - 1)}
                    className="wbtn"
                    aria-label={`Previous phase · ${PH[i - 1]}`}
                    onClick={(e) => {
                      e.preventDefault();
                      go(phaseHref(p.no - 1));
                    }}
                  >
                    <Ic n="chevron-left" />
                    <span>
                      Phase {p.no - 1} · {PH[i - 1]}
                    </span>
                  </a>
                ) : null}
                {p.no < 4 ? (
                  <a
                    href={phaseHref(p.no + 1)}
                    className="wbtn"
                    aria-label={`Next phase · ${PH[i + 1]}`}
                    onClick={(e) => {
                      e.preventDefault();
                      go(phaseHref(p.no + 1));
                    }}
                  >
                    <span>
                      Phase {p.no + 1} · {PH[i + 1]}
                    </span>
                    <Ic n="chevron-right" />
                  </a>
                ) : null}
              </div>
              <button
                type="button"
                className="ring"
                aria-label={`Phase ${p.no} · ${pct}% · ${p.done} of ${p.total} steps done`}
                data-tt={`Phase ${p.no} · ${p.done} of ${p.total} steps done`}
                data-notip=""
                onClick={drillPhase}
              >
                <span className="rw">
                  <RingSvg pct={pct} col={p.state === 'done' ? '#2fd3a0' : '#e6c46e'} />
                  <span className="pc">{pct}%</span>
                </span>
                <small>Phase {p.no}</small>
              </button>
            </div>
          </div>
        </section>

        <section className="card acc psum" aria-label="Phase progress">
          <div className="ch" style={{ padding: 0 }}>
            <h2 className="lbl">
              Progress
              <InfoBtn
                label="About this phase"
                spec={{ title, text: phInfo(d.short)[i]!, answer: { ...ans, why: phWhy(d.short)[i], source: PH_SRC[i] } }}
              />
            </h2>
            <span className="sp" />
            <span className="cnt">
              {p.done} of {p.total} steps
            </span>
          </div>
          <div className="bw">
            <PhaseBar p={p} plan={plan} doneEnd={doneEnd} onClick={drillPhase} />
            <span className="glab">
              <b>{pct}%</b>
              <span>
                {p.done} / {p.total} steps
              </span>
              {p.state === 'done' && plan && doneEnd && doneEnd !== plan[1] ? (
                doneEnd > plan[1] ? (
                  <span className="e late">
                    {days(plan[1], doneEnd)} day{days(plan[1], doneEnd) === 1 ? '' : 's'} late
                  </span>
                ) : (
                  <span className="e early">{days(doneEnd, plan[1])} days early</span>
                )
              ) : null}
            </span>
          </div>
          <div className="kd">
            {plan ? (
              <span>
                Starts <b>{fmt(plan[0])}</b>
              </span>
            ) : null}
            {endD ? (
              <span>
                {p.state === 'done' ? 'Finished' : 'Ends'} <b>{fmt(endD)}</b>
              </span>
            ) : null}
            {curNow ? (
              <span>
                Now{' '}
                <a
                  href={stepHrefOf(curNow)}
                  onClick={(e) => {
                    e.preventDefault();
                    go(stepHrefOf(curNow));
                  }}
                >
                  Step {curNow.n} · {curNow.title}
                </a>
              </span>
            ) : null}
            {p.no === 2 && coi ? (
              <span>
                COI{' '}
                <b>
                  {fmt(coi)}
                  {d.coiDate ? '' : ' (expected)'}
                </b>
              </span>
            ) : null}
            {d.leadName ? (
              <span>
                Reviewer <b>{d.leadName}</b>
              </span>
            ) : null}
          </div>
        </section>

        <div className="sgrid">
          <div className="scol">
            <section className="card acc" aria-label="Steps">
              <div className="ch">
                <h2 className="lbl">Steps</h2>
                <span className="sp" />
                <span className="cnt">{p.total} steps</span>
              </div>
              <div style={{ padding: '0 8px 8px' }}>
                <StepTable
                  phase={p}
                  variant="phase"
                  cur={focusStep?.id}
                  short={d.short}
                  coi={d.coiExpected}
                  ownershipType={d.ownershipType}
                  openViewer={viewer.open as (docs: ViewerDoc[], i?: number) => void}
                />
              </div>
            </section>
          </div>
          <div className="scol side2">
            {focusStep ? <JourneyRail p={p} focus={focusStep.id} d={d} isPage={false} /> : null}
            <section className="card acc team" aria-label="Who’s doing it">
              <div className="ch">
                <h2 className="lbl">Who’s doing it</h2>
              </div>
              <div className="obar" role="group" aria-label={`Owners in Phase ${p.no}`}>
                {O.filter((o) => o[1].length).map((o) => (
                  <button
                    key={o[3]}
                    type="button"
                    style={{ flex: o[1].length, background: o[2] }}
                    aria-label={`${o[0]} · ${o[1].length} steps`}
                    data-tt={`${o[0]} · ${o[1].length} of ${p.total} steps`}
                    data-notip=""
                    onClick={() => drillOwner(o[3])}
                  />
                ))}
              </div>
              <div className="lgd">
                {O.filter((o) => o[3] !== 'MCA' || o[1].length).map((o) => (
                  <button key={o[3]} type="button" className="lg" aria-label={`Steps owned by ${o[0]} · ${o[1].length}`} onClick={() => drillOwner(o[3])}>
                    <i style={{ background: o[2] }} />
                    <span>{o[0]}</span>
                    <b>{o[1].length}</b>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>

        <nav className="pn" aria-label="Phases">
          <button type="button" className="btn" onClick={() => go(p.no > 1 ? phaseHref(p.no - 1) : portalHref('incorporation'))}>
            <Ic n="arrow-left" />
            <span>{p.no > 1 ? `Phase ${p.no - 1}` : 'All phases'}</span>
          </button>
          <button type="button" className="btn" onClick={() => go(p.no < 4 ? phaseHref(p.no + 1) : portalHref('incorporation'))}>
            <span>{p.no < 4 ? `Phase ${p.no + 1}` : 'All phases'}</span>
            <Ic n="arrow-right" />
          </button>
        </nav>
        {d.noEngagement ? <BotSay text="There is no incorporation project on your account yet." /> : null}
      </div>
      {viewer.node}
    </IncFrame>
  );
}

