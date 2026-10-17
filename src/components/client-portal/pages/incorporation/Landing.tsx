'use client';

/**
 * INCORPORATION LANDING — FINAL `renderLanding()` (final-src/s/inc/incorporation.html):
 * row 1 = Days-to-COI tile + This week · row 2 = Timeline (gantt, accordion
 * step tables) · row 3 = four donuts. Wired to the real step model.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isAwaitingClientApproval } from '@/lib/checklist-step-approval';
import { isStepReleasedToClient } from '@/lib/checklist-visibility';
import { extractItemResponses } from '@/lib/checklist-responses';
import { getStepAttachmentRequirements } from '@/lib/checklist-step-attachments';
import { isReviewRejected, isAwaitingReview } from '@/lib/checklist-item-review';
import { clientBoardResolutionPath } from '@/lib/project-step-path';
import type { PortalPhase, PortalStep } from '@/lib/client-portal/step-model';
import { phaseHref, portalHref } from '../../routes';
import { usePortal, type DrillConfig, type DrillRow } from '../../PortalProvider';
import { useDocViewer, type ViewerDoc } from '../documents/DocViewer';
import { signedUrlFor } from './data';
import {
  BotSay,
  Bmini,
  Ic,
  IncFrame,
  InfoBtn,
  Si,
  addD,
  days,
  fmt,
  fmtY,
  pd,
  useCountUp,
  wd,
  type InfoSpec,
} from './ui';
import {
  INFO_WHY,
  PHL,
  PH_TIP,
  firstName,
  idx,
  kd,
  ownKey,
  phDoneEnd,
  phKind,
  phPlan,
  stRow,
  stepHrefOf,
  tabsFor,
  useIncData,
  type IncData,
} from './data';
import { StepTable } from './StepTable';
import { StatusBrief } from './StatusBrief';
import { BoardResolutionLink } from './BoardLink';
import { TimelineEdit } from './TimelineEdit';

type Seg = [label: string, n: number, color: string, rows: DrillRow[]];

/* ---------------- donut data (rule 14) ---------------- */

function docSegs(d: IncData): { you: Seg[]; sbc: Seg[] } {
  const docsHref = portalHref('documents');
  const sub: DrillRow[] = [];
  const review: DrillRow[] = [];
  const pend: DrillRow[] = [];
  const back: DrillRow[] = [];
  const gen: DrillRow[] = [];
  const spend: DrillRow[] = [];
  const signed: DrillRow[] = [];
  const seen = new Set<string>();
  const curPhase = d.model.current?.phaseNo ?? 4;
  for (const s of d.model.steps) {
    const k = kd(s);
    const released = k === 'done' || isStepReleasedToClient(s.slice);
    if (!released && k !== 'you' && k !== 'prog') continue;
    const responses = extractItemResponses(s.item, s.slice);
    const reqs = getStepAttachmentRequirements(s.item, responses, d.ownershipType);
    for (const r of reqs) {
      const key = `${s.id}:${r.fieldId}`;
      seen.add(key);
      if (s.owner === 'client') {
        const row: DrillRow = { title: r.label, meta: `From ${d.short}`, href: docsHref };
        if (r.uploaded) {
          if (isReviewRejected(s.slice) && (s.slice?.unlockedFields ?? []).includes(r.fieldId)) back.push(row);
          else if (isAwaitingReview(s.slice)) review.push(row);
          else sub.push(row);
        } else if (k === 'you' || k === 'prog') pend.push(row);
      } else {
        const row: DrillRow = { title: r.label, meta: 'Prepared by SBC', href: docsHref };
        if (r.uploaded) gen.push(row);
        else if (k !== 'done' && s.phaseNo <= curPhase && released) spend.push(row);
      }
    }
  }
  for (const r of d.extras?.fileRequests ?? []) {
    const key = `${r.stepId}:${r.fieldId}`;
    const row: DrillRow = { title: r.label, meta: `From ${d.short}`, href: docsHref };
    if (!r.fulfilledAt) {
      if (!seen.has(key) || !pend.some((x) => x.title === r.label)) pend.push(row);
    } else if (!seen.has(key)) {
      const step = d.model.byId[r.stepId];
      (step && kd(step) === 'done' ? sub : review).push(row);
    }
  }
  const br = d.extras?.boardResolution;
  if (br?.status === 'finalized' && br.hasDocx) gen.push({ title: 'Board resolution', meta: 'Prepared by SBC', href: clientBoardResolutionPath() });
  if (br?.signedUploadedAt) signed.push({ title: 'Board resolution (signed)', meta: `From ${d.short}`, href: clientBoardResolutionPath() });
  return {
    you: [
      ['Submitted', sub.length, '#15805f', sub],
      ['Under review', review.length, '#2453c7', review],
      ['Pending', pend.length, '#d9731f', pend],
      ['Sent back', back.length, '#cf3a2f', back],
    ],
    sbc: [
      ['Generated', gen.length, '#2f6fd0', gen],
      ['Pending', spend.length, '#dfe4ec', spend],
      [`Signed by ${d.short}`, signed.length, '#15805f', signed],
    ],
  };
}

function segData(d: IncData) {
  const left = d.model.steps.filter((x) => kd(x) !== 'done');
  const coi = d.coiExpected;
  const rows = (l: PortalStep[]) => l.map((x) => stRow(x, coi));
  const you = left.filter((x) => ownKey(x) === 'You');
  const sbc = left.filter((x) => ownKey(x) === 'SBC');
  const mca = left.filter((x) => ownKey(x) === 'MCA');
  const act = d.model.steps.filter((x) => ['you', 'prog', 'with'].includes(kd(x)));
  const over = act.filter((x) => x.late);
  const risk = act.filter((x) => !x.late && kd(x) === 'you');
  const ok = act.filter((x) => !x.late && kd(x) !== 'you');
  const docs = docSegs(d);
  return {
    you: docs.you,
    sbc: docs.sbc,
    who: [
      [d.short, you.length, '#c9a24b', rows(you)],
      ['SBC', sbc.length, '#2f6fd0', rows(sbc)],
      ['MCA', mca.length, '#6b3fc4', rows(mca)],
    ] as Seg[],
    plan: [
      ['On time', ok.length, '#15805f', rows(ok)],
      ['At risk', risk.length, '#d9731f', rows(risk)],
      ['Overdue', over.length, '#cf3a2f', rows(over)],
    ] as Seg[],
  };
}

function Donut({ k, title, segs, onSeg }: { k: string; title: string; segs: Seg[]; onSeg: (i: number) => void }) {
  const { tipAt } = usePortal();
  const tot = segs.reduce((a, s) => a + s[1], 0);
  const R = 38;
  const C = 2 * Math.PI * R;
  let off = 0;
  const nz = segs.filter((q) => q[1]).length;
  return (
    <section className="card acc dc" aria-label={title}>
      <h2 className="lbl">{title}</h2>
      <div className="dn">
        <div className="dnut">
          <svg viewBox="0 0 96 96" aria-hidden="true">
            {segs.map((s, i) => {
              if (!s[1]) return null;
              const l = (C * s[1]) / tot;
              const g = nz > 1 ? 1.2 : 0;
              const el = (
                <circle
                  key={i}
                  className="sg"
                  cx="48"
                  cy="48"
                  r={R}
                  stroke={s[2]}
                  strokeDasharray={`${Math.max(l - g, 0.1).toFixed(2)} ${(C - l + g).toFixed(2)}`}
                  strokeDashoffset={(-off).toFixed(2)}
                  data-seg={`${k}:${i}`}
                  onMouseMove={(e) => tipAt(e.clientX, e.clientY, `${s[0]} · ${s[1]}`)}
                  onMouseLeave={() => tipAt(0, 0, null)}
                  onClick={() => {
                    tipAt(0, 0, null);
                    onSeg(i);
                  }}
                />
              );
              off += l;
              return el;
            })}
            {tot === 0 ? <circle cx="48" cy="48" r={R} fill="none" stroke="var(--hair)" strokeWidth={13} /> : null}
          </svg>
          <span className="c">{tot}</span>
        </div>
        <div className="lgd">
          {segs.map((s, i) => (
            <button key={s[0]} type="button" className="lg" aria-label={`${title} · ${s[0]} · ${s[1]}`} onClick={() => onSeg(i)}>
              <i style={{ background: s[2] }} />
              <span>{s[0]}</span>
              <b>{s[1]}</b>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- gantt helpers ---------------- */

interface Axis {
  ax0: string;
  ax1: string;
}

function weekRange(today: string): string {
  const d = pd(today);
  const dow = (d.getUTCDay() + 6) % 7;
  const mon = addD(today, -dow);
  const sun = addD(mon, 6);
  const a = pd(mon);
  const b = pd(sun);
  return a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()} – ${fmt(sun)}` : `${fmt(mon)} – ${fmt(sun)}`;
}

export default function IncorporationLanding() {
  const d = useIncData();
  const portal = usePortal();
  const { after, go, toast, drill, openChat } = portal;
  const viewer = useDocViewer();
  const { model, short, today } = d;
  const [openPh, setOpenPh] = useState<number | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  /* ---------- COI tile ---------- */
  const showAfter = after && Boolean(d.coiDate);
  const coiEnd = d.coiExpected;
  const daysLeft = coiEnd ? Math.max(0, days(today, coiEnd)) : null;
  const shown = useCountUp(showAfter ? null : daysLeft, !showAfter);
  const you = model.steps.find((x) => kd(x) === 'you');
  const spice = model.spice;
  const all = model.all;

  const drillRing = useCallback(() => {
    const sp = model.steps.filter((x) => x.phaseNo <= 2);
    const tabs = tabsFor(sp, d.coiExpected);
    drill({
      title: 'SPICe+ progress',
      sub: `Phases 1 and 2 · ${spice.done} of ${spice.total} steps done`,
      tabs,
      active: idx(tabs, 'you'),
      link: { lead: 'SPICe+ ends with the Certificate of Incorporation', text: 'Open Phase 2 →', href: phaseHref(2), where: 'the phase pages' },
    });
  }, [model.steps, spice, drill, d.coiExpected]);

  const drillAll = useCallback(() => {
    const tabs = tabsFor(model.steps, d.coiExpected);
    drill({ title: `All ${all.total} steps`, sub: `${all.done} done · ${all.total - all.done} to go`, tabs, active: idx(tabs, after ? 'with' : 'you') });
  }, [model.steps, all, after, drill, d.coiExpected]);

  const drillPhase = useCallback(
    (p: PortalPhase) => {
      const tabs = tabsFor(p.steps, d.coiExpected);
      const c = (k: string) => p.steps.some((x) => kd(x) === k);
      const act = c('you') ? 'you' : c('with') ? 'with' : c('prog') ? 'prog' : p.done === p.total ? 'done' : 'up';
      drill({
        title: PHL[p.no - 1]!,
        sub: `${p.done} of ${p.total} steps done`,
        tabs,
        active: idx(tabs, act),
        link: { lead: 'Every step of this phase', text: 'Open the phase page →', href: phaseHref(p.no), where: 'the phase page' },
      });
    },
    [drill, d.coiExpected],
  );

  const coiInfo: InfoSpec = showAfter
    ? {
        title: 'About the incorporation date',
        text: `${short} was incorporated on ${wd(d.coiDate!)} ${fmtY(d.coiDate!)}, the date on the Certificate of Incorporation. Every post-incorporation deadline counts from it.`,
        answer: { title: 'Incorporation date', text: `The date on ${short}’s Certificate of Incorporation.`, why: INFO_WHY.coi, source: `VCFO Suite · ${short}’s incorporation project`, href: portalHref('incorporation') },
      }
    : {
        title: 'Days to COI',
        text: `Counts down to the end of the incorporation window ${short}’s manager set${coiEnd ? ` (${wd(coiEnd)} ${fmtY(coiEnd)})` : ''}. After the Certificate of Incorporation it shows the real incorporation date.`,
        answer: {
          title: 'Days to COI',
          text: `Counts down to the end of the incorporation window ${short}’s manager set. After the Certificate of Incorporation it shows the real incorporation date.`,
          why: INFO_WHY.coi,
          source: `VCFO Suite · ${short}’s incorporation project`,
          href: portalHref('incorporation'),
        },
      };

  const ringBtn = (
    <button
      type="button"
      className="ring"
      aria-label={`SPICe+ progress · ${spice.pct}% · ${spice.done} of ${spice.total} steps done`}
      data-tt={`SPICe+ · ${spice.done} of ${spice.total} steps done`}
      data-notip=""
      onClick={drillRing}
    >
      <span className="rw">
        <RingSvg pct={spice.pct} />
        <span className="pc">{spice.pct}%</span>
      </span>
      <small>SPICe+</small>
    </button>
  );

  const openCert = () => {
    if (!d.certificate) return;
    const c = d.certificate;
    viewer.open([{ id: `cert:${c.storagePath}`, name: c.name, url: () => signedUrlFor(c.storagePath), meta: 'Certificate of Incorporation' }], 0);
  };

  const coiTile = (
    <section className={`coi${coiEnd || showAfter ? '' : ' no-coi'}`} aria-label={showAfter ? 'Incorporated' : 'Days to COI'}>
      <div className="t1">
        {showAfter ? (
          <>
            <button
              type="button"
              className="big"
              aria-label={`Incorporated ${fmtY(d.coiDate)}`}
              data-tt={`Certificate of Incorporation · ${wd(d.coiDate!)} ${fmtY(d.coiDate)}`}
              data-notip=""
              onClick={drillRing}
            >
              <b>{fmt(d.coiDate)}</b>
              <span>incorporated</span>
            </button>
            <InfoBtn label="About the incorporation date" spec={coiInfo} />
            <span className="tr1">
              {coiEnd ? <EarlyChip coi={d.coiDate!} end={coiEnd} /> : null}
              {ringBtn}
            </span>
          </>
        ) : (
          <>
            <button
              type="button"
              className="big"
              aria-label={coiEnd ? `${daysLeft} days to COI · expected ${wd(coiEnd)} ${fmtY(coiEnd)}` : 'Incorporation window not set yet'}
              data-tt={
                coiEnd
                  ? `Expected ${wd(coiEnd)} ${fmtY(coiEnd)}${d.extras?.windowSetByName ? ` · window set by ${d.extras.windowSetByName}` : ''}`
                  : 'Your manager hasn’t set the incorporation window yet'
              }
              data-notip=""
              onClick={drillRing}
            >
              {coiEnd ? (
                <>
                  <b id="coiN">{shown ?? daysLeft}</b>
                  <span>{daysLeft === 1 ? 'day to COI' : 'days to COI'}</span>
                </>
              ) : (
                <>
                  <b>—</b>
                  <span>days to COI</span>
                </>
              )}
            </button>
            <InfoBtn label="About days to COI" spec={coiInfo} />
            <span className="tr1">
              {you ? (
                <a
                  href={stepHrefOf(you)}
                  className="chip risk"
                  aria-label={`At risk · step ${you.n} · ${you.title}`}
                  data-tt={`Step ${you.n} is waiting on ${short}${you.due ? ` · due ${fmt(you.due)}` : ''}`}
                  data-notip=""
                  onClick={(e) => {
                    e.preventDefault();
                    go(stepHrefOf(you));
                  }}
                >
                  At risk · step {you.n}
                </a>
              ) : null}
              {ringBtn}
            </span>
          </>
        )}
      </div>
      <div className="sub">
        {showAfter ? (
          <>
            <span>
              {d.companyName} · incorporated {wd(d.coiDate!)} {fmt(d.coiDate)}
            </span>
            {d.identifiers.cin || d.identifiers.pan || d.identifiers.tan ? (
              <span className="mono">· {issuedLine(d.identifiers)} issued</span>
            ) : null}
            {d.certificate ? (
              // eslint-disable-next-line jsx-a11y/anchor-is-valid -- prototype markup: a gold text link
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  openCert();
                }}
              >
                Open certificate
              </a>
            ) : null}
          </>
        ) : (
          <span>
            {d.companyName}
            {coiEnd ? ` · expected ${wd(coiEnd)} ${fmt(coiEnd)}` : ' · your manager hasn’t set the incorporation window yet'}
          </span>
        )}
      </div>
      <div className="hr" style={{ marginLeft: 0 }}>
        <button
          type="button"
          className="hbtn"
          aria-haspopup="dialog"
          aria-expanded={briefOpen}
          aria-label="Monthly status brief"
          data-tt="Monthly status brief"
          data-notip=""
          onClick={() => setBriefOpen(true)}
        >
          <Ic n="download" />
          <span className="lt">Monthly status brief</span>
        </button>
        <BoardResolutionLink br={d.extras?.boardResolution ?? null} />
      </div>
      <button type="button" className="pill" aria-label={`${all.done} of ${all.total} steps done · ${all.pct}%`} onClick={drillAll}>
        <span>
          {all.done} / {all.total} steps
        </span>
        <span className="tr">
          <i style={{ width: `${Math.max(all.pct, 2)}%` }} />
        </span>
        <b>{all.pct}%</b>
      </button>
    </section>
  );

  /* ---------- This week ---------- */
  const week = useMemo(() => {
    type Row = { o: 'You' | 'SBC' | 'MCA'; t: string; dt: string; step: PortalStep };
    const rows: Row[] = [];
    const used = new Set<string>();
    const soon = addD(today, 3);
    for (const r of d.extras?.fileRequests ?? []) {
      if (r.fulfilledAt) continue;
      const step = model.byId[r.stepId];
      if (!step) continue;
      rows.push({
        o: 'You',
        t: `Upload ${r.label}${r.requestedByName ? ` · requested by ${firstName(r.requestedByName)}` : ''}`,
        dt: r.dueDate ? fmt(r.dueDate) : step.due ? fmt(step.due) : 'now',
        step,
      });
    }
    for (const s of model.steps) {
      if (isAwaitingClientApproval(s.slice)) {
        rows.push({ o: 'You', t: `Check & approve step ${s.n}`, dt: s.due ? fmt(s.due) : 'now', step: s });
        used.add(s.id);
      }
    }
    const rest = model.steps
      .filter((x) => !used.has(x.id) && ['you', 'prog', 'with'].includes(kd(x)))
      .sort((a, b) => (a.due ?? '9999') < (b.due ?? '9999') ? -1 : 1);
    for (const s of rest) {
      const o = ownKey(s);
      rows.push({ o, t: s.title, dt: o === 'You' ? (s.due ? fmt(s.due) : '—') : !s.due || s.due <= soon ? 'now' : fmt(s.due), step: s });
    }
    const mon = addD(today, -((pd(today).getUTCDay() + 6) % 7));
    const sun = addD(mon, 6);
    const mca = model.steps.find((x) => x.owner === 'mca' && kd(x) === 'with' && (!x.due || x.due <= sun));
    const anyYou = rows.some((r) => r.o === 'You');
    return {
      rows: rows.slice(0, 4),
      range: weekRange(today),
      bot: !anyYou ? `Nothing is waiting on ${short} this week.` : mca ? `MCA: ${mca.title} this week.` : 'MCA: nothing pending this week.',
    };
  }, [d.extras?.fileRequests, model, today, short]);

  const weekCard = (
    <section className="card week" aria-label="This week">
      <div className="ch">
        <h2 className="lbl">This week</h2>
        <span className="cnt">{week.range}</span>
        <span className="wbot">
          <Bmini />
          <span>{week.bot}</span>
        </span>
      </div>
      {week.rows.map((r, i) => (
        <a
          key={`${r.step.id}-${i}`}
          href={stepHrefOf(r.step)}
          className="wr"
          aria-label={`${r.t} · ${r.o === 'You' ? short : r.o} · ${r.dt}`}
          onClick={(e) => {
            e.preventDefault();
            go(stepHrefOf(r.step));
          }}
        >
          <span className={`own ${r.o}`}>{r.o === 'You' ? short : r.o}</span>
          <span className="t">{r.t}</span>
          <span className="dt">{r.dt}</span>
        </a>
      ))}
    </section>
  );

  /* ---------- Timeline (gantt) ---------- */
  const coiForPlan = d.coiDate ?? d.coiExpected;
  const plans = useMemo(() => {
    const ps = model.phases.map((p) => phPlan(p, coiForPlan));
    // Part B starts where Part A's plan ends (prototype PLAN[2]).
    const a = ps[0];
    const b = ps[1];
    if (a && b && b[0] < a[1] && a[1] < b[1]) ps[1] = [a[1], b[1]];
    return ps;
  }, [model.phases, coiForPlan]);
  const axis: Axis | null = useMemo(() => {
    const ds = plans.flatMap((p) => (p ? [p[0], p[1]] : []));
    for (const p of model.phases) {
      const e = phDoneEnd(p);
      if (e && p.state === 'done') ds.push(e);
    }
    if (!ds.length) return null;
    ds.push(today);
    ds.sort();
    return { ax0: addD(ds[0]!, -7), ax1: addD(ds.at(-1)!, 7) };
  }, [plans, model.phases, today]);
  const forceSimple = !axis || plans.some((p) => !p);
  const pos = (s: string) => (axis ? Math.max(0, Math.min(1, days(axis.ax0, s) / days(axis.ax0, axis.ax1))) * 100 : 0);
  const cardRef = useRef<HTMLElement>(null);
  const [simple, setSimple] = useState(forceSimple);

  const layoutGantt = useCallback(() => {
    const c = cardRef.current;
    if (!c || !axis) {
      setSimple(true);
      return;
    }
    const gl = c.querySelector<HTMLElement>('.gl');
    if (!gl) return;
    // measure in gantt mode
    c.classList.remove('simple');
    const W = gl.getBoundingClientRect().width;
    let simpleNow = forceSimple || W < 500;
    const ax = c.querySelector('.gax');
    const sp = (W * 7) / days(axis.ax0, axis.ax1);
    ax?.classList.toggle('e2', sp < 58 && sp >= 29);
    ax?.classList.toggle('e4', sp < 29);
    if (!simpleNow) {
      c.querySelectorAll<HTMLElement>('.gl').forEach((g) => {
        const b = g.querySelector<HTMLElement>('.gbar');
        const lb = g.querySelector<HTMLElement>('.glab');
        if (!b || !lb) return;
        const a = (parseFloat(b.style.left) / 100) * W;
        const e = a + (parseFloat(b.style.width) / 100) * W;
        const lw = lb.getBoundingClientRect().width;
        lb.style.left = '';
        lb.style.right = '';
        if (W - e >= lw + 18) lb.style.left = `${e + 14}px`;
        else if (a >= lw + 14) lb.style.right = `${W - a + 10}px`;
        // Neither side has room (a long bar): sit the label on the bar's end
        // rather than dropping the whole card to the phone layout.
        else lb.style.right = `${Math.max(0, W - e) + 8}px`;
      });
    }
    if (simpleNow) {
      c.querySelectorAll<HTMLElement>('.glab').forEach((lb) => {
        lb.style.left = '';
        lb.style.right = '';
      });
    }
    c.classList.toggle('simple', simpleNow);
    setSimple(simpleNow);
  }, [axis, forceSimple]);

  useLayoutEffect(() => {
    layoutGantt();
  });
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = () => {
      clearTimeout(t);
      t = setTimeout(layoutGantt, 80);
    };
    window.addEventListener('resize', on);
    void document.fonts?.ready.then(() => layoutGantt());
    return () => {
      window.removeEventListener('resize', on);
      clearTimeout(t);
    };
  }, [layoutGantt]);

  const axisLabels = useMemo(() => {
    if (!axis) return [];
    const out: string[] = [];
    let x = addD(axis.ax0, 7);
    while (x <= addD(axis.ax1, -2)) {
      out.push(x);
      x = addD(x, 7);
    }
    return out;
  }, [axis]);

  const rangeLabel = useMemo(() => {
    if (!axis) return '';
    const a = pd(addD(axis.ax0, 7));
    const b = pd(addD(axis.ax1, -7));
    const M = (x: Date) => x.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
    return a.getUTCFullYear() === b.getUTCFullYear()
      ? `${M(a)} – ${M(b)} ${b.getUTCFullYear()}`
      : `${M(a)} ${a.getUTCFullYear()} – ${M(b)} ${b.getUTCFullYear()}`;
  }, [axis]);

  const phaseRow = (p: PortalPhase, i: number) => {
    const open = openPh === p.no;
    const plan = plans[i];
    const doneEnd = phDoneEnd(p);
    const end = p.state === 'done' && doneEnd ? doneEnd : plan?.[1];
    const last = plan && end && end > plan[1] ? end : plan?.[1];
    const a = plan ? pos(plan[0]) : 0;
    const b = last ? pos(last) : 100;
    const w = plan ? Math.max(b - a, 1.5) : 100;
    const cls = p.state === 'done' ? 's-done' : p.state === 'up' ? 's-up' : 's-active';
    const pct = Math.round((p.done / p.total) * 100);
    let fill = pct;
    let late: React.ReactNode = null;
    let extra: React.ReactNode = null;
    if (p.state === 'done') {
      fill = 100;
      if (plan && doneEnd) {
        const dl = days(plan[1], doneEnd);
        if (dl > 0) {
          const lp = (dl / Math.max(1, days(plan[0], doneEnd))) * 100;
          late = <i className="lt" style={{ width: `${lp.toFixed(1)}%` }} />;
          extra = <span className="e late">{dl} day{dl === 1 ? '' : 's'} late</span>;
        } else if (dl < 0) extra = <span className="e early">{-dl} days early</span>;
      }
    }
    const tip = `${PHL[i]} · ${p.done} of ${p.total} done${plan ? ` · ${fmt(plan[0])} → ${fmt(plan[1])}` : ''}`;
    const nw = p.state === 'active' ? p.steps.find((x) => ['you', 'prog', 'with'].includes(kd(x))) : undefined;
    const kname = p.state === 'done' ? 'done' : p.state === 'up' ? 'upcoming' : 'in progress';
    return (
      <div className={`phr${open ? ' open' : ''}`} data-p={p.no} key={p.id}>
        <div className="phh">
          <button
            type="button"
            className="btn sm stb"
            aria-expanded={open}
            aria-controls={`phb-${p.no}`}
            aria-label={`${open ? 'Hide' : 'Show'} the steps of ${PHL[i]}`}
            onClick={() => setOpenPh(open ? null : p.no)}
          >
            <Ic n="chevron-right" />
            Steps
          </button>
          <div className="pnm">
            <Si k={phKind(p)} tip={`${PHL[i]} · ${kname}`} cls="xl" />
            <span className="tx">{PHL[i]}</span>
          </div>
          <div className="gl">
            <button
              type="button"
              className={`gbar ${cls}`}
              style={{ left: `${a.toFixed(2)}%`, width: `${w.toFixed(2)}%` }}
              aria-label={tip}
              data-tt={tip}
              data-notip=""
              onClick={() => drillPhase(p)}
            >
              <span className="in">
                <i className="f" style={{ width: `${fill}%` }} />
                {late}
                {nw ? (
                  <span className="nw" style={{ left: `calc(${fill}% + 6px)` }}>
                    Now · step {nw.n}
                  </span>
                ) : null}
              </span>
              {p.no === 2 ? <i className="ms" /> : null}
            </button>
            <span className="glab">
              <b>{pct}%</b>
              <span>
                {p.done} / {p.total} steps
              </span>
              {extra}
            </span>
            {axis && !simple ? (
              <button
                type="button"
                className="today"
                style={{ left: `${pos(today).toFixed(2)}%` }}
                aria-label={`Today · ${wd(today)} ${fmt(today)}`}
                data-tt={`Today · ${wd(today)} ${fmt(today)}`}
                data-notip=""
                onClick={() => toast(`Today · ${wd(today)} ${fmtY(today)}`)}
              />
            ) : null}
          </div>
          <a
            href={phaseHref(p.no)}
            className="btn sm ob"
            aria-label={`Open the ${PHL[i]} page`}
            data-tt={PH_TIP[i]}
            data-notip=""
            onClick={(e) => {
              e.preventDefault();
              go(phaseHref(p.no));
            }}
          >
            Open
            <Ic n="arrow-right" />
          </a>
        </div>
        <div className="phb" id={`phb-${p.no}`} role="region" aria-label={`${PHL[i]} steps`}>
          {open ? (
            <StepTable
              phase={p}
              variant="landing"
              short={short}
              coi={d.coiExpected}
              ownershipType={d.ownershipType}
              openViewer={viewer.open as (docs: ViewerDoc[], i?: number) => void}
            />
          ) : null}
        </div>
      </div>
    );
  };

  const phasesCard = (
    <section className={`card acc phc${simple ? ' simple' : ''}`} id="phc" ref={cardRef}>
      <div className="ch">
        <h2 className="lbl">
          Timeline
          <InfoBtn
            label="About the timeline"
            spec={{
              title: 'The timeline',
              text: 'Each bar is the planned window of a phase. The fill is the share of steps done; red is time past the plan. The red line is today; the gold diamond is the COI.',
              answer: {
                title: 'The timeline',
                text: 'Each bar is the planned window of a phase. The fill is the share of steps done; red is time past the plan. The red line is today; the gold diamond is the COI.',
                why: INFO_WHY.phases,
                source: `VCFO Suite · ${short}’s incorporation project`,
                href: portalHref('incorporation'),
              },
            }}
          />
        </h2>
        <span className="sp" />
        <span className="cnt">
          {all.done} of {all.total} steps{rangeLabel ? ` · ${rangeLabel}` : ''}
        </span>
        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid -- prototype markup: the Edit link button */}
        <a
          className="btn btn-o"
          href="#"
          style={{ height: 30, padding: '0 10px', fontSize: 12, marginLeft: 10 }}
          aria-label="Edit the timeline"
          onClick={(e) => {
            e.preventDefault();
            setEditOpen(true);
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
            <path className="duo" d="M14.5 5.5l4 4L9 19l-4.5 1 1-4.5Z" />
            <path d="M15.5 4.5a2 2 0 0 1 2.9 0l1.1 1.1a2 2 0 0 1 0 2.9L9 19l-4.5 1 1-4.5Z M13.5 6.5l4 4" />
          </svg>
          Edit
        </a>
      </div>
      {axis ? (
        <div className="gax" aria-hidden="true">
          <span />
          <span />
          <div className="tl">
            {axisLabels.map((x) => (
              <span key={x} style={{ left: `${pos(x).toFixed(2)}%` }}>
                {fmt(x)}
              </span>
            ))}
          </div>
          <span className="ob0" />
        </div>
      ) : null}
      {model.phases.map(phaseRow)}
    </section>
  );

  /* ---------- donuts ---------- */
  const segs = useMemo(() => segData(d), [d]);
  const SEG_T = { you: `Documents from ${short}`, sbc: 'Documents SBC prepares', who: 'Who’s working on what', plan: 'On plan vs overdue' } as const;
  const drillSeg = (key: keyof typeof SEG_T, i: number) => {
    const s = segs[key];
    const docs = key === 'you' || key === 'sbc';
    const cfg: DrillConfig = {
      title: SEG_T[key],
      sub: `${s.reduce((t, q) => t + q[1], 0)}${docs ? ' documents' : ' steps'}`,
      tabs: s.map((q) => ({ label: q[0], color: q[2], rows: q[3] })),
      active: i,
    };
    if (docs) cfg.link = { lead: 'Every document, with versions', text: 'Open Documents →', href: portalHref('documents'), where: 'Documents' };
    drill(cfg);
  };

  return (
    <IncFrame pending={d.pending} title="Incorporation · VCFO Suite">
      {d.noEngagement ? (
        <div className="wrap lp">
          <section className="card" style={{ padding: 18 }}>
            <BotSay
              text="There is no incorporation project on your account yet. Your SBC team adds it when the engagement starts."
              btn="Ask VCFO"
              onBtn={() => openChat('When does my incorporation start?')}
            />
          </section>
        </div>
      ) : (
        <div className="wrap lp">
          <div className="r2">
            {coiTile}
            {weekCard}
          </div>
          {phasesCard}
          <div className="dg">
            <Donut k="you" title={SEG_T.you} segs={segs.you} onSeg={(i) => drillSeg('you', i)} />
            <Donut k="sbc" title={SEG_T.sbc} segs={segs.sbc} onSeg={(i) => drillSeg('sbc', i)} />
            <Donut k="who" title={SEG_T.who} segs={segs.who} onSeg={(i) => drillSeg('who', i)} />
            <Donut k="plan" title={SEG_T.plan} segs={segs.plan} onSeg={(i) => drillSeg('plan', i)} />
          </div>
        </div>
      )}
      {briefOpen ? <StatusBrief d={d} onClose={() => setBriefOpen(false)} /> : null}
      {editOpen ? <TimelineEdit onClose={() => setEditOpen(false)} /> : null}
      {viewer.node}
    </IncFrame>
  );
}

function issuedLine(ids: { cin?: string; pan?: string; tan?: string }): string {
  const l = [ids.cin ? 'CIN' : '', ids.pan ? 'PAN' : '', ids.tan ? 'TAN' : ''].filter(Boolean);
  return l.length > 1 ? `${l.slice(0, -1).join(', ')} and ${l.at(-1)}` : l[0] ?? '';
}

function EarlyChip({ coi, end }: { coi: string; end: string }) {
  const e = days(coi, end);
  const txt = e > 0 ? `${e} days early` : e < 0 ? `${-e} days late` : 'On the day';
  return (
    <span className={`chip ${e >= 0 ? 'done' : 'late'}`} role="img" aria-label={txt} data-tt={`Window ended ${wd(end)} ${fmt(end)}`}>
      {txt}
    </span>
  );
}

export function RingSvg({ pct, col }: { pct: number; col?: string }) {
  const R = 20;
  const C = 2 * Math.PI * R;
  const l = (C * pct) / 100;
  return (
    <svg viewBox="0 0 50 50" aria-hidden="true">
      <circle cx="25" cy="25" r={R} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="5" />
      <circle
        cx="25"
        cy="25"
        r={R}
        fill="none"
        stroke={col ?? '#e6c46e'}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${Math.max(l, 0.01).toFixed(2)} ${C.toFixed(2)}`}
      />
    </svg>
  );
}

