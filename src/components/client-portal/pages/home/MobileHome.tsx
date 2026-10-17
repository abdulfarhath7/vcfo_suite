'use client';

/**
 * Phone Home (< 700 px) — React port of prototype s/home/mobile.html with its
 * #after state: L1 skeleton (450 ms), stagger, count-up and draw-in, gold-tab
 * cards with (i), bottom sheets for every drill (rule 14 on mobile), the
 * upload sheet (Choose a file / Take a photo), the focus track (style E),
 * gantt, donut, IDs with reveal, registrations with ↗ / 📎, post-inc windows.
 * The board's own top bar, drawer, launcher and chat sheet are the shell's
 * (TopBar, Sidebar drawer, AskLauncher) in the real app.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BotSays, InfoPopover } from '@/components/client-portal/shared';
import { portalHref, stepHref } from '@/components/client-portal/routes';
import { IdsRevealDialog, useRevealedIdentifier } from '@/components/client-portal/pages/credentials/IdsRevealDialog';
import type { PortalStep } from '@/lib/client-portal/step-model';
import type { HomeData } from './useHome';
import { buildSbcRows, overdueCount } from './CardsA';
import { stagesOf } from './Popups';
import { copyText, useDownload } from './ui';
import {
  BUCKET_LABEL,
  BUCKETS,
  bucketOf,
  dHeader,
  dShort,
  dayMon,
  days,
  filingName,
  filingPortal,
  FT_PHONE,
  rel,
  timelineAxis,
  type DocItem,
  type NeedRow,
  type RegRow,
  type TlPhase,
} from './derive';

const PATHS: Record<string, string> = {
  check: '<path d="M6 12.5l4 4 8-9"/>',
  clock: '<path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="9" r="3.4" fill="currentColor" stroke="none"/><path d="M5.5 19c1.2-3.2 3.6-4.6 6.5-4.6s5.3 1.4 6.5 4.6" fill="currentColor" stroke="none"/>',
  arrow: '<path d="M6 15l5-5 3 3 5-5 M14 8h5v5"/>',
  bang: '<path d="M12 6.5v7 M12 17.5h.01"/>',
  dl: '<path d="M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 19.5h14"/>',
  eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z"/>',
  ext: '<path d="M14 4.5h5.5V10 M19.5 4.5 11 13 M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10"/>',
  clip: '<path d="M15.5 7.5 8.6 14.4a2 2 0 0 0 2.8 2.8l7.3-7.3a3.8 3.8 0 0 0-5.4-5.4L6 11.8a5.6 5.6 0 0 0 8 8l5.5-5.5"/>',
  go: '<path d="M9 6l6 6-6 6"/>',
  up: '<path d="M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 19.5h14"/>',
  copy: '<path d="M9 9h10v11H9Z M5 15V4h10"/>',
};
function I({ n, s = 16, w = 2 }: { n: keyof typeof PATHS; s?: number; w?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: PATHS[n]! }} />;
}
type K = 'done' | 'now' | 'you' | 'sbc' | 'up' | 'late';
const ST: Record<K, [keyof typeof PATHS | '', string]> = { done: ['check', 'Done'], now: ['clock', 'In progress'], you: ['user', 'Waiting on you'], sbc: ['arrow', 'With SBC'], up: ['', 'Upcoming'], late: ['bang', 'Late'] };
function Si({ k, tip }: { k: K; tip?: string }) {
  const [ic, label] = ST[k];
  return (
    <span className={`si ${k}`} role="img" aria-label={tip ?? label} title={tip ?? label}>
      {ic ? <I n={ic} s={13} w={2.6} /> : null}
    </span>
  );
}
function stepK(s: PortalStep): K {
  if (s.late && s.kind !== 'done') return 'late';
  return s.kind === 'done' ? 'done' : s.kind === 'you' || s.kind === 'prog' ? 'you' : s.kind === 'with' ? 'sbc' : 'up';
}
function Tile({ iso, kind }: { iso: string; kind: 'over' | 'due' | 'up' | 'navy' }) {
  const [d, m] = dayMon(iso);
  const c = { over: { background: 'var(--over)', color: '#fff' }, due: { background: 'var(--due)', color: '#fff' }, up: { background: 'var(--raised)', color: 'var(--fg)' }, navy: { background: 'var(--navy)', color: '#fff' } }[kind];
  return (
    <span className="tile" style={c}>
      {d}
      <small>{m}</small>
    </span>
  );
}

/* ------------------------------------------------------------- pill */
function MSeg({ id, tabs, sel, onSel }: { id: string; tabs: [string, number | string][]; sel: number; onSel: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [th, setTh] = useState<{ w: number; x: number } | null>(null);
  useEffect(() => {
    const place = () => {
      const b = ref.current?.querySelectorAll('button')[sel] as HTMLButtonElement | undefined;
      if (b) setTh({ w: b.offsetWidth, x: b.offsetLeft - 2 });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [sel, tabs.length]);
  return (
    <div className="seg" role="tablist" data-seg={id} ref={ref}>
      <span className="th" style={th ? { width: th.w, transform: `translateX(${th.x}px)` } : undefined} />
      {tabs.map((t, i) => (
        <button key={t[0]} type="button" role="tab" aria-selected={i === sel} onClick={() => onSel(i)}>
          {t[0]}
          <span className="c">{t[1]}</span>
        </button>
      ))}
    </div>
  );
}

function Bot({ text, act, q }: { text: string; act?: string; q?: string }) {
  return (
    <div style={{ padding: '10px 14px 14px' }}>
      <BotSays size={44} action={act ?? 'Ask VCFO why'} question={q ?? text}>
        <b style={{ display: 'block', font: '600 13px/1.45 Manrope' }}>{text}</b>
      </BotSays>
    </div>
  );
}

function Card({ id, title, info, children, foot, right }: { id: string; title: string; info: string; children: ReactNode; foot?: [string, () => void]; right?: ReactNode }) {
  return (
    <section className="card t" id={`m-${id}`}>
      <div className="ch">
        <h2>{title}</h2>
        <InfoPopover askAbout={title} label="About this card">
          {info}
        </InfoPopover>
        {right}
      </div>
      {children}
      {foot ? (
        <button className="go" type="button" onClick={foot[1]}>
          {foot[0]} <I n="go" s={14} w={2.4} />
        </button>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------ count-up */
function Count({ v, ready }: { v: number | string; ready: boolean }) {
  const isInt = typeof v === 'number' && Number.isInteger(v);
  const [n, setN] = useState(isInt ? 0 : v);
  useEffect(() => {
    if (!isInt) return setN(v);
    if (!ready) return setN(0);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setN(v);
    const t0 = performance.now();
    let raf = 0;
    const f = (now: number) => {
      const p = Math.min(1, (now - t0) / 900);
      setN(Math.round((v as number) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [v, ready, isInt]);
  return <>{n}</>;
}

/* ---------------------------------------------------------- sheet drill */
type DRow = { k: K; t: string; s: string; route: string };
function SheetDrill({ parts, sel, rowsFor, go }: { parts: [string, number][]; sel: number; rowsFor: (i: number) => DRow[]; go: (r: string) => void }) {
  const [i, setI] = useState(sel);
  const rows = rowsFor(i);
  return (
    <>
      <MSeg id="drill" tabs={parts} sel={i} onSel={setI} />
      <div>
        {rows.length ? (
          rows.map((r, j) => (
            <button key={`${r.t}-${j}`} className="row" type="button" onClick={() => go(r.route)}>
              <Si k={r.k} />
              <span className="t">
                <b>{r.t}</b>
                <span>{r.s}</span>
              </span>
              <I n="go" s={14} w={2.4} />
            </button>
          ))
        ) : (
          <Bot text="Nothing here right now." act="" />
        )}
      </div>
    </>
  );
}

export function MobileHome({ h, onEditTimeline, phases, onOpenDocs }: { h: HomeData; onEditTimeline: () => void; phases: TlPhase[] | null; onOpenDocs: (docs: DocItem[], i: number) => void }) {
  const { portal, model, company, after, today } = h;
  const [ready, setReady] = useState(false);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => {
      setReady(true);
      requestAnimationFrame(() => setTimeout(() => setDrawn(true), 60));
    }, rm ? 0 : 450);
    return () => clearTimeout(t);
  }, []);

  /* bottom sheet */
  const [sheet, setSheet] = useState<{ title: string; key: string; body: ReactNode } | null>(null);
  const last = useRef<HTMLElement | null>(null);
  const xRef = useRef<HTMLButtonElement>(null);
  const openSheet = useCallback((title: string, key: string, body: ReactNode) => {
    setSheet((cur) => {
      if (cur && cur.key === key) return null;
      last.current = document.activeElement as HTMLElement;
      return { title, key, body };
    });
  }, []);
  const closeSheet = useCallback(() => {
    setSheet(null);
    last.current?.focus?.({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!sheet) return;
    const t = setTimeout(() => xRef.current?.focus({ preventScroll: true }), 30);
    const k = (e: KeyboardEvent) => e.key === 'Escape' && closeSheet();
    document.addEventListener('keydown', k);
    document.querySelector('.cp')?.classList.add('sheet-open');
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', k);
      document.querySelector('.cp')?.classList.remove('sheet-open');
    };
  }, [sheet, closeSheet]);
  const goR = useCallback(
    (r: string) => {
      setSheet(null);
      portal.go(r);
    },
    [portal],
  );
  const drill = (title: string, parts: [string, number][], sel: number, rowsFor: (i: number) => DRow[]) =>
    openSheet(title, `${title}:${sel}`, <SheetDrill parts={parts} sel={sel} rowsFor={rowsFor} go={goR} />);

  /* steps drill (M-22) */
  const spice = model.steps.filter((s) => s.phaseNo <= 2);
  const stepSub = (s: PortalStep) =>
    s.kind === 'done'
      ? `Step ${s.n} · done ${dShort(s.doneOn)}`
      : s.kind === 'you' || s.kind === 'prog'
        ? `Step ${s.n} · ${company} · ${s.kind === 'you' && s.due ? `due ${dShort(s.due)}` : 'in progress'}`
        : s.kind === 'with'
          ? `Step ${s.n} · SBC · in progress${s.due ? ` · ${dShort(s.due)}` : ''}`
          : `Step ${s.n}${s.due ? ` · ${dShort(s.due)}` : ''}`;
  const groupsOf: [string, (s: PortalStep) => boolean][] = [
    ['Done', (s) => s.kind === 'done'],
    [company, (s) => s.kind === 'you' || s.kind === 'prog'],
    ['SBC', (s) => s.kind === 'with'],
    ['Upcoming', (s) => s.kind === 'up' || s.kind === 'next'],
  ];
  const stepsDrill = (sel: number) =>
    drill(
      'Incorporation steps',
      groupsOf.map(([l, f]) => [l, spice.filter(f).length]),
      sel,
      (i) => spice.filter(groupsOf[i]![1]).map((s) => ({ k: stepK(s), t: s.title, s: stepSub(s), route: stepHref(s.id) })),
    );
  const groupIdx = (s: PortalStep) => Math.max(0, groupsOf.findIndex(([, f]) => f(s)));

  /* due / overdue drill */
  const openF = h.filings.filter((f) => bucketOf(f, today) !== 'filed');
  const overRows = (): DRow[] =>
    after
      ? openF.filter((f) => bucketOf(f, today) === 'overdue').map((f) => ({ k: 'late', t: filingName(f), s: `Overdue ${days(f.dueDate, today)} day${days(f.dueDate, today) === 1 ? '' : 's'}${f.owner === 'client' ? ` · ${company}` : f.owner ? ' · SBC' : ''}`, route: portalHref('compliances') }))
      : [
          ...h.needs.filter((n) => n.due && n.due < today).map<DRow>((n) => ({ k: 'late', t: n.title, s: `${n.sub} · ${n.kind === 'correct' ? 'sent back · fix now' : `due ${dShort(n.due)}`}`, route: n.href ?? portalHref('incorporation') })),
          ...model.steps.filter((s) => s.late && s.kind !== 'done' && !h.needs.some((n) => n.stepId === s.id && n.due && n.due < today)).map<DRow>((s) => ({ k: 'late', t: s.title, s: `Step ${s.n} · late by ${s.lateDays} day${s.lateDays === 1 ? '' : 's'}`, route: stepHref(s.id) })),
        ];
  const soonRows = (): DRow[] =>
    after
      ? openF.filter((f) => bucketOf(f, today) === 'dueSoon').map((f) => ({ k: f.owner === 'client' ? 'you' : 'sbc', t: filingName(f), s: `${dShort(f.dueDate)}${f.owner === 'client' ? ` · ${company}` : f.owner ? ' · SBC' : ''}`, route: portalHref('compliances') }))
      : h.needs.filter((n) => n.due && n.due >= today && days(today, n.due) <= 15).map((n) => ({ k: 'you', t: n.title, s: `${n.sub} · due ${dShort(n.due)}`, route: n.href ?? portalHref('incorporation') }));
  const dueDrill = (sel: number) => {
    const o = overRows();
    const d = soonRows();
    drill('Due and overdue', [['Overdue', o.length], ['Due soon', d.length]], sel, (i) => (i ? d : o));
  };

  /* -------------------------------------------------------------- greet */
  const C = 2 * Math.PI * 26;
  const post = model.phases[2];
  const ring = after ? (post && post.total ? Math.round((post.done / post.total) * 100) : 0) : model.spice.pct;
  const regsDone = h.regs.filter((r) => r.status === 'Registered').length;
  const reqC = h.home?.requestCounts;
  const stats: { v: number | string; l: string; on: () => void }[] = after
    ? [
        { v: h.needs.length, l: `Waiting on ${company}`, on: () => stepsDrill(1) },
        { v: overdueCount(h), l: 'Overdue', on: () => dueDrill(0) },
        { v: h.buckets.dueSoon, l: 'Due soon', on: () => dueDrill(1) },
        { v: `${regsDone}/${h.regs.length}`, l: 'Registrations', on: () => regDrill(0) },
        { v: h.overview?.engagement.incorporationDate ? dShort(h.overview.engagement.incorporationDate) : '—', l: 'Incorporated', on: () => portal.go('incorporation') },
      ]
    : [
        { v: h.needs.length, l: `Waiting on ${company}`, on: () => stepsDrill(1) },
        { v: model.counts.with, l: 'With SBC', on: () => stepsDrill(2) },
        { v: overdueCount(h), l: 'Overdue', on: () => dueDrill(0) },
        { v: reqC && reqC.total ? `${reqC.fulfilled}/${reqC.total}` : '—', l: 'Docs in', on: () => docsDrill() },
        { v: model.coiExpected ? dShort(model.coiExpected) : '—', l: 'Expected COI', on: () => portal.go('incorporation') },
      ];
  const docsDrill = () => {
    const ups = h.needs.filter((n) => n.kind === 'upload');
    const inn = h.docs.filter((d) => d.from === 'client');
    drill('Documents', [['In', inn.length], ['Missing', ups.length]], 0, (i) =>
      i ? ups.map((n) => ({ k: 'you', t: n.title, s: n.due ? `Due ${dShort(n.due)}` : n.sub, route: portalHref('documents') })) : inn.map((d) => ({ k: 'done', t: d.name, s: 'Received', route: portalHref('documents') })),
    );
  };
  const regDrill = (sel: number) => {
    const g: RegRow['status'][] = ['Registered', 'In progress', 'Upcoming'];
    drill('Registrations', [['Done', h.regs.filter((r) => r.status === 'Registered').length], ['With SBC', h.regs.filter((r) => r.status === 'In progress').length], ['Upcoming', h.regs.filter((r) => r.status === 'Upcoming').length]], sel, (i) =>
      h.regs.filter((r) => r.status === g[i]).map((r) => ({ k: r.status === 'Registered' ? 'done' : r.status === 'In progress' ? 'sbc' : 'up', t: r.name, s: `${r.authority} · ${r.dateLabel}`, route: stepHref(r.step.id) })),
    );
  };
  const reportHref = h.engagementId ? `/api/ask/brief?engagementId=${encodeURIComponent(h.engagementId)}` : undefined;

  /* -------------------------------------------------------------- needs */
  const [needTab, setNeedTab] = useState(0);
  const NT: [NeedRow['kind'], string][] = [['upload', 'Upload'], ['fill', 'Fill'], ['correct', 'Correct'], ['sign', 'Sign']];
  const fileRef = useRef<HTMLInputElement>(null);
  const upTarget = useRef<NeedRow | null>(null);
  const uploadSheet = (n: NeedRow) =>
    openSheet(
      n.title,
      `up:${n.key}`,
      <>
        <button className="row" type="button" onClick={() => pickFile(n, false)}>
          <I n="up" s={18} />
          <span className="t">
            <b>Choose a file</b>
            <span>PDF, JPG or PNG · up to 10 MB</span>
          </span>
        </button>
        <button className="row" type="button" onClick={() => pickFile(n, true)}>
          <I n="eye" s={18} />
          <span className="t">
            <b>Take a photo</b>
            <span>Use the phone camera</span>
          </span>
        </button>
      </>,
    );
  const pickFile = (n: NeedRow, camera: boolean) => {
    upTarget.current = n;
    const el = fileRef.current;
    if (!el) return;
    if (camera) el.setAttribute('capture', 'environment');
    else el.removeAttribute('capture');
    el.value = '';
    el.click();
  };
  const needAct = (n: NeedRow) => {
    if (n.requestId && (n.kind === 'upload' || n.kind === 'correct')) return uploadSheet(n);
    if (n.kind === 'correct' && n.href) return portal.go(n.href);
    portal.toast(`${NT.find((x) => x[0] === n.kind)![1]} · ${n.title} opened`);
    if (n.href) portal.go(n.href);
  };
  const needRows = h.needs.filter((n) => n.kind === NT[needTab]![0]);

  /* ----------------------------------------------------------- holds */
  const idx = spice.findIndex((s) => s.kind !== 'done');
  const doneBefore = idx < 0 ? spice.length : idx;
  const around = useMemo(() => {
    if (idx < 0) return [] as PortalStep[];
    let end = spice.findIndex((s, i) => i > idx && (s.kind === 'up' || s.kind === 'next'));
    if (end < 0) end = spice.length - 1;
    return spice.slice(Math.max(0, idx - 1), Math.min(end + 1, idx + 6));
  }, [spice, idx]);
  const more = spice.length - (spice.indexOf(around.at(-1)!) + 1);
  const cur = model.current && model.current.phaseNo <= 2 ? model.current : undefined;
  const ph1 = model.phases[0];

  /* ---------------------------------------------------------- gantt */
  const gantt = (() => {
    if (!phases) return null;
    const ax = timelineAxis(phases, today);
    const f = (iso: string) => days(ax.t0, iso) / ax.span;
    const color = (p: TlPhase) => (p.id === 'coi' ? 'var(--gold)' : p.done || after ? 'oklch(56% .14 150)' : p.id === 'mca' ? 'var(--up)' : 'var(--navy-3)');
    const name = (p: TlPhase) => (p.id === 'coi' ? `COI · ${dShort(p.from)}` : p.id === 'p2' && !p.done ? `Phase 2 · ${p.pct ?? 0}%` : p.name);
    const tp = f(today);
    return (
      <div className="gantt">
        {phases.map((p, i) => (
          <button key={p.id} className="gr" type="button" onClick={() => stepsDrill(i === 0 ? 0 : i === 3 ? 3 : 1)}>
            <span>{name(p)}</span>
            <span className="gt">
              <i style={{ left: `${f(p.from) * 100}%`, width: `${Math.max(3, (f(p.to) - f(p.from)) * 100)}%`, background: color(p), transitionDelay: `${i * 0.08}s` }} />
            </span>
          </button>
        ))}
        {!after && tp >= 0 && tp <= 1 ? <span className="today" aria-hidden="true" style={{ left: `calc(14px + 120px + (100% - 148px) * ${tp.toFixed(3)})` }} /> : null}
      </div>
    );
  })();

  /* ------------------------------------------------------------ SBC */
  const sbc = buildSbcRows(h);
  const sbcDrill = (sel: number) =>
    drill('What SBC is doing', [['In progress', sbc.filter((s) => s.pct !== 0).length], ['Not started', sbc.filter((s) => s.pct === 0).length]], sel, (i) =>
      sbc.filter((s) => (i ? s.pct === 0 : s.pct !== 0)).map((s) => ({ k: s.pct === 0 ? 'up' : 'sbc', t: s.title, s: s.pct ? `${s.pct}% · ${h.lead ?? 'SBC'}` : s.pct === 0 ? 'Not started yet' : s.info, route: s.href })),
    );

  /* ------------------------------------------------------------ next */
  const [nextTab, setNextTab] = useState(0);
  const nextList = openF.filter((f) => bucketOf(f, today) === 'overdue' || days(today, f.dueDate) <= (nextTab ? 30 : 15));
  const c15 = openF.filter((f) => bucketOf(f, today) === 'overdue' || days(today, f.dueDate) <= 15).length;
  const c30 = openF.filter((f) => bucketOf(f, today) === 'overdue' || days(today, f.dueDate) <= 30).length;

  /* ------------------------------------------------------------ comp */
  const total = h.filings.length;
  const compCols = ['oklch(56% .14 150)', 'var(--due)', 'var(--over)', 'var(--up)'];
  const compDrill = (sel: number) =>
    drill(`Compliance status · ${h.home?.filings.fyLabel ?? ''}`, BUCKETS.map((b) => [BUCKET_LABEL[b], h.buckets[b]]), sel, (i) => {
      const list = h.filings.filter((f) => bucketOf(f, today) === BUCKETS[i]);
      const rows = list.slice(0, 6).map<DRow>((f) => ({
        k: i === 0 ? 'done' : i === 2 ? 'late' : i === 3 ? 'up' : f.owner === 'client' ? 'you' : 'sbc',
        t: filingName(f),
        s: i === 0 && f.filedOn ? `Filed ${dShort(f.filedOn)}` : i === 2 ? `Overdue ${days(f.dueDate, today)} day${days(f.dueDate, today) === 1 ? '' : 's'}` : `${dShort(f.dueDate)}${f.owner === 'client' ? ` · ${company}` : f.owner ? ' · SBC' : ''}`,
        route: portalHref('filings'),
      }));
      if (list.length > 6) rows.push({ k: 'up', t: `… ${list.length - 6} more`, s: 'Open Filings', route: portalHref('filings') });
      return rows;
    });

  /* ------------------------------------------------------------ ids */
  const [reveal, setReveal] = useState<'pan' | 'tan' | null>(null);
  const panR = useRevealedIdentifier('pan');
  const tanR = useRevealedIdentifier('tan');
  const ids = h.home?.identifiers ?? {};
  const idRows: [string, string | undefined, 'pan' | 'tan' | null, string, string | null][] = [
    ['CIN', ids.cin, null, 'https://www.mca.gov.in', null],
    ['PAN', ids.panMasked, 'pan', 'https://www.incometax.gov.in', panR],
    ['TAN', ids.tanMasked, 'tan', 'https://www.tin-nsdl.com', tanR],
    ['GSTIN', ids.gstin, null, 'https://www.gst.gov.in', null],
  ];

  /* ----------------------------------------------------------- docs */
  const download = useDownload();
  const [actTab, setActTab] = useState(0);
  const acts = h.home?.activity ?? [];
  const actRows = acts.filter((a) => actTab === 0 || (actTab === 1 ? a.actorKind !== 'client' : a.actorKind === 'client'));

  /* ------------------------------------------------------------ cards */
  const greet = (
    <section className="greet" id="greet">
      <div className="top">
        <div>
          <div className="d">{dHeader(today)}</div>
          <h1>{h.companyName}</h1>
        </div>
        <button className="ring" type="button" aria-label={`${after ? 'Setup' : 'Incorporation'} ${ring}% — open steps`} onClick={() => (after ? drill('Post-incorporation setup', [['Open', h.post.open.length], ['Completed', h.post.done.length]], 0, postRows) : stepsDrill(0))}>
          <svg width="62" height="62" viewBox="0 0 62 62">
            <circle cx="31" cy="31" r="26" fill="none" stroke="oklch(100% 0 0 / .14)" strokeWidth="6" />
            <circle cx="31" cy="31" r="26" fill="none" stroke="var(--gold)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${drawn ? (ring / 100) * C : 0} ${C}`} style={{ transition: 'stroke-dasharray 1s cubic-bezier(.22,1,.36,1)' }} />
          </svg>
          <span className="v">
            <Count v={ring} ready={ready} />%
          </span>
          <span className="l">{after ? 'SETUP' : 'SPICE+'}</span>
        </button>
      </div>
      <div className="stats">
        {stats.slice(0, 3).map((s) => (
          <button key={s.l} className="stat" type="button" onClick={s.on}>
            <b>
              <Count v={s.v} ready={ready} />
            </b>
            <span>{s.l}</span>
          </button>
        ))}
      </div>
      <div className="stats" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))', marginTop: 6 }}>
        {stats.slice(3).map((s) => (
          <button key={s.l} className="stat" type="button" onClick={s.on}>
            <b>{s.v}</b>
            <span>{s.l}</span>
          </button>
        ))}
      </div>
      <div className="rep">
        {reportHref ? (
          <a className="btn btn-g" href={reportHref} download onClick={() => portal.toast(`Preparing ${company}’s progress report (PDF)…`)}>
            <I n="dl" s={15} />
            Download report
          </a>
        ) : null}
        <button className="btn btn-gl" type="button" onClick={() => portal.go('incorporation')}>
          Open Incorporation
        </button>
      </div>
    </section>
  );
  function postRows(i: number): DRow[] {
    return i
      ? h.post.done.map((s) => ({ k: 'done', t: s.title, s: `Completed${s.doneOn ? ` · ${dShort(s.doneOn)}` : ''}`, route: stepHref(s.id) }))
      : h.post.open.map((p) => ({
          k: p.overDays ? 'late' : p.owner === 'client' ? 'you' : 'sbc',
          t: p.step.title,
          s: `${p.owner === 'client' ? company : 'SBC'} · ${p.overDays ? `overdue ${p.overDays} day${p.overDays === 1 ? '' : 's'} · ` : ''}${dShort(p.dueDate)}`,
          route: stepHref(p.step.id),
        }));
  }

  const needsCard = (
    <Card id="needs" title={`Needs from ${company}`} info={`Items ${company}’s project lead asked for. Upload, fill, correct or sign them here.`}>
      <MSeg id="needs" tabs={NT.map(([k, l]) => [l, h.needs.filter((n) => n.kind === k).length])} sel={needTab} onSel={setNeedTab} />
      <div>
        {needRows.length ? (
          needRows.map((n) => {
            const over = Boolean(n.due && n.due < today);
            const sub = n.kind === 'correct' ? `Sent back${n.note ? ` · ${n.note}` : n.sub ? ` · ${n.sub}` : ''}` : [n.area, n.askedBy ? `${n.area ? 'asked' : 'Asked'} by ${n.askedBy}` : ''].filter(Boolean).join(' · ') || n.sub;
            return (
              <div key={n.key} className="row" style={{ cursor: 'default' }}>
                {n.due ? <Tile iso={n.due} kind={over ? 'over' : days(today, n.due) <= 7 ? 'due' : 'up'} /> : <span className="tile" style={{ background: 'var(--raised)', color: 'var(--fg)' }}>—</span>}
                <span className="t">
                  <b>{n.title}</b>
                  <span title={sub} style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{over && n.kind !== 'correct' ? `Overdue ${days(n.due!, today)} day${days(n.due!, today) === 1 ? '' : 's'}` : sub}</span>
                </span>
                <button className={`btn btn-sm ${over ? 'btn-n' : 'btn-o'}`} type="button" onClick={() => needAct(n)}>
                  {n.kind === 'correct' ? 'Fix' : NT.find((x) => x[0] === n.kind)![1]}
                </button>
              </div>
            );
          })
        ) : (
          <Bot text={`Nothing to ${NT[needTab]![1].toLowerCase()} right now. You are all caught up here.`} />
        )}
      </div>
    </Card>
  );

  const holdsCard = (
    <Card id="holds" title="Who holds it now" info={`${company}’s current step and the steps around it. Tap a step for its details.`} foot={cur ? [`Open step ${cur.n}`, () => portal.go(stepHref(cur.id))] : ['Open Incorporation', () => portal.go('incorporation')]}>
      <div className="ft">
        <div className="rail">
          <i style={{ height: drawn ? `${Math.round((doneBefore / Math.max(1, spice.length)) * 100)}%` : 0 }} />
        </div>
        {doneBefore > 0 ? (
          <button className="fold" type="button" onClick={() => stepsDrill(0)}>
            <I n="check" s={12} w={3} />
            {doneBefore} done{ph1 && ph1.state === 'done' ? ' · Phase 1' : ''}
          </button>
        ) : null}
        {around.map((s) => {
          if (cur && s.id === cur.id) {
            const st = stagesOf(h, s);
            return (
              <button key={s.id} className="fs cur" type="button" onClick={() => stepsDrill(groupIdx(s))}>
                <Si k="now" tip={s.kind === 'you' ? `Waiting on ${company}${s.due ? ` · due ${dShort(s.due)}` : ''}` : 'In progress'} />
                <span className="t">
                  <span className="eb">Now · step {s.n} of {spice.length}</span>
                  <b>{s.title}</b>
                  <span>
                    Step {s.n} · {s.owner === 'client' ? company : 'SBC'}
                    {s.due ? ` · due ${dShort(s.due)}` : ''}
                  </span>
                  <span className="ticks" style={{ margin: '6px 0 0' }}>
                    {st.map((x) => (
                      <i key={x.name} className={x.state === 'done' ? 'd' : x.state === 'now' ? 'n' : undefined} />
                    ))}
                  </span>
                </span>
              </button>
            );
          }
          const k = stepK(s);
          return (
            <button key={s.id} className="fs" type="button" onClick={() => stepsDrill(groupIdx(s))}>
              <Si k={k} tip={k === 'you' ? 'In progress · You' : k === 'sbc' ? 'With SBC' : undefined} />
              <span className="t">
                <b>{s.title}</b>
                <span>{s.kind === 'up' || s.kind === 'next' ? `Step ${s.n} · ${s.owner === 'client' ? company : 'SBC'}${s.windowFrom ? ` · from ${dShort(s.windowFrom)}` : ''}` : stepSub(s)}</span>
              </span>
            </button>
          );
        })}
        {more > 0 ? (
          <button className="fold" type="button" style={{ background: 'light-dark(#fff, oklch(13% 0 89.9))', color: 'var(--muted)', boxShadow: 'inset 0 0 0 1.5px var(--up)' }} onClick={() => stepsDrill(3)}>
            +{more} more · SPICe+ filing → COI
          </button>
        ) : null}
      </div>
    </Card>
  );

  const timelineCard = (
    <Card
      id="timeline"
      title="Timeline"
      info={after ? 'Incorporation is complete.' : 'Planned dates for each phase. The red line is today.'}
      foot={['Open Incorporation', () => portal.go('incorporation')]}
      right={
        !after && phases ? (
          <button className="btn btn-sm btn-o r" type="button" style={{ marginLeft: 'auto', order: 3 }} onClick={onEditTimeline}>
            Edit
          </button>
        ) : null
      }
    >
      {h.home?.timeline.pending && !after ? (
        <div style={{ padding: '0 14px 8px' }}>
          <button type="button" className="tle-pend" onClick={() => portal.toast(`Waiting for ${h.manager ?? 'your project manager'} to approve · “${h.home!.timeline.pending!.reason.slice(0, 60)}”`)}>
            Change request pending{h.home.timeline.pending.coiTo ? ` · COI ${dShort(h.home.timeline.pending.coiTo)}` : ''}
          </button>
        </div>
      ) : null}
      {gantt ?? <Bot text="SBC has not planned the dates yet." q="When will SBC plan the incorporation dates?" />}
    </Card>
  );

  const alertsCard = (
    <Card id="alerts" title="Important alerts" info="Dated items only, nearest first.">
      {h.alerts.rows.length ? (
        h.alerts.rows.map((a) => (
          <button key={a.key} className="row" type="button" onClick={() => drill('Important alerts', [['15 days', h.alerts.rows.filter((x) => days(today, x.date) <= 15).length], ['30 days', h.alerts.rows.filter((x) => days(today, x.date) <= 30).length]], 0, (i) => h.alerts.rows.filter((x) => days(today, x.date) <= (i ? 30 : 15)).map((x) => ({ k: x.tone === 'due' ? 'you' : 'up', t: x.title, s: `${dayMon(x.date).join(' ')} · ${rel(today, x.date)}`, route: x.href })))}>
            <Tile iso={a.date} kind={a.tone === 'due' ? 'due' : 'up'} />
            <span className="t">
              <b>{a.title}</b>
              <span>{rel(today, a.date)}</span>
            </span>
            <I n="go" s={14} w={2.4} />
          </button>
        ))
      ) : (
        <Bot text="Nothing dated coming up." act="" />
      )}
    </Card>
  );

  const sbcCard = (
    <Card id="sbcdo" title="What SBC is doing" info={after ? 'Work the SBC team is doing now.' : 'Work the SBC team is doing now. Tap for the detail.'}>
      {sbc.length ? (
        sbc.map((s) => (
          <button key={s.key} className="row" type="button" onClick={() => sbcDrill(s.pct === 0 ? 1 : 0)}>
            <Si k={s.pct === 0 ? 'up' : 'sbc'} tip={s.pct ? `With SBC · ${s.pct}%` : s.pct === 0 ? 'Upcoming' : 'With SBC'} />
            <span className="t">
              <b>{s.title}</b>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span className="pb">
                  <i style={{ width: `${s.pct ?? 100}%`, background: s.pct == null ? 'var(--prog-light)' : 'oklch(56% .19 262)' }} />
                </span>
                {s.pct != null ? <span className="mono" style={{ fontSize: 11 }}>{s.pct}%</span> : null}
              </span>
            </span>
          </button>
        ))
      ) : (
        <Bot text={`SBC has nothing open for ${company} right now.`} act="" />
      )}
    </Card>
  );

  const nextCard = (
    <Card id="next" title="What is next" info="Filings due in the next 15 or 30 days. ↗ opens the official portal." foot={['Open Compliances', () => portal.go('compliances')]}>
      <MSeg
        id="next"
        tabs={[
          ['15 days', c15],
          ['30 days', c30],
        ]}
        sel={nextTab}
        onSel={setNextTab}
      />
      {nextList.length ? (
        nextList.map((f) => {
          const over = bucketOf(f, today) === 'overdue';
          const p = filingPortal(f);
          return (
            <div key={f.id} className="row" style={{ cursor: 'default' }}>
              <Tile iso={f.dueDate} kind={over ? 'over' : days(today, f.dueDate) <= 7 ? 'due' : 'up'} />
              <span className="t">
                <b>{filingName(f)}</b>
                <span>
                  {over ? `Overdue ${days(f.dueDate, today)} day${days(f.dueDate, today) === 1 ? '' : 's'}` : rel(today, f.dueDate)}
                  {f.owner === 'client' ? ` · ${company}` : f.owner ? ' · SBC' : ''}
                </span>
              </span>
              {p ? (
                <a className="ic" href={p[0]} target="_blank" rel="noopener noreferrer" aria-label={`Open ${p[1]}`}>
                  <I n="ext" s={14} />
                </a>
              ) : null}
              <button className="ic" type="button" aria-label={`Open ${f.title}`} onClick={() => dueDrill(over ? 0 : 1)}>
                <I n="go" s={14} w={2.4} />
              </button>
            </div>
          );
        })
      ) : (
        <Bot text={`No filings due in the next ${nextTab ? 30 : 15} days.`} act="" />
      )}
    </Card>
  );

  const compCard = (() => {
    const Cc = 2 * Math.PI * 44;
    let off = 0;
    return (
      <Card id="comp" title="Compliance status" info="Hover a slice for its count · click a slice, a legend row or the centre to see the list" foot={['Open Filings', () => portal.go('filings')]}>
        <div className="dn">
          <svg width="110" height="110" viewBox="0 0 110 110">
            {BUCKETS.map((b, i) => {
              const len = total ? (h.buckets[b] / total) * Cc : 0;
              const el = (
                <circle
                  key={b}
                  className="s"
                  cx="55"
                  cy="55"
                  r="44"
                  fill="none"
                  stroke={compCols[i]}
                  strokeWidth="14"
                  strokeDasharray={`${drawn ? len : 0} ${Cc}`}
                  strokeDashoffset={-off}
                  tabIndex={0}
                  role="button"
                  aria-label={`${BUCKET_LABEL[b]} · ${h.buckets[b]}`}
                  onClick={() => compDrill(i)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && compDrill(i)}
                >
                  <title>{`${BUCKET_LABEL[b]} · ${h.buckets[b]}`}</title>
                </circle>
              );
              off += len;
              return el;
            })}
          </svg>
          <div className="lg">
            <div style={{ font: "600 26px 'Space Grotesk'", letterSpacing: '-.03em' }}>
              <Count v={total} ready={ready} /> <span style={{ font: '700 11px Manrope', color: 'var(--muted)', letterSpacing: 0 }}>this FY</span>
            </div>
            {BUCKETS.map((b, i) => (
              <button key={b} type="button" onClick={() => compDrill(i)}>
                <i style={{ background: compCols[i] }} />
                {BUCKET_LABEL[b]}
                <b>{h.buckets[b]}</b>
              </button>
            ))}
          </div>
        </div>
      </Card>
    );
  })();

  const idsCard = (
    <Card id="ids" title="Company IDs" info="PAN and TAN stay hidden. Reveal asks for your password and hides again after 60 s.">
      {idRows.map(([k, v, secret, url, clear]) => (
        <div key={k} className="idr">
          <span className="k">{k}</span>
          <span className="v" style={clear ? { color: 'var(--ok-text)' } : undefined}>
            {clear ?? v ?? '—'}
          </span>
          {v && secret ? (
            <button className="ic" type="button" aria-label={`Reveal ${k}`} onClick={() => setReveal(secret)}>
              <I n="eye" s={15} />
            </button>
          ) : v ? (
            <button className="ic" type="button" aria-label={`Copy ${k}`} onClick={() => void copyText(v).then((ok) => portal.toast(ok ? `Copied · ${v}` : 'Copy blocked by this browser'))}>
              <I n="copy" s={14} />
            </button>
          ) : null}
          <a className="ic" href={url} target="_blank" rel="noopener noreferrer" aria-label="Open the official portal">
            <I n="ext" s={14} />
          </a>
        </div>
      ))}
    </Card>
  );

  // Phone shows a short list (mobile.html#after): done, in progress and the
  // next upcoming ones; the rest live in the Registrations sheet (HM-10).
  const regsShown = [...h.regs.filter((r) => r.status !== 'Upcoming'), ...h.regs.filter((r) => r.status === 'Upcoming').slice(0, 2)];
  const regsCard = (
    <Card
      id="regs"
      title="Registrations"
      info="Every registration with its portal ↗ and its proof 📎."
      foot={regsShown.length < h.regs.length ? [`All ${h.regs.length} registrations`, () => regDrill(regsShown.some((r) => r.status === 'Registered') ? 0 : 2)] : undefined}
    >
      {regsShown.map((r) => {
        const k: K = r.status === 'Registered' ? 'done' : r.status === 'In progress' ? 'sbc' : 'up';
        return (
          <div key={r.step.id} className="row" style={{ cursor: 'default' }}>
            <Si k={k} />
            <span className="t">
              <b>{r.name}</b>
              <span>
                {r.authority} · {r.dateLabel}
              </span>
            </span>
            {r.status === 'Registered' ? (
              r.certPath ? (
                <button className="pr" type="button" aria-label={`Open proof for ${r.name}`} onClick={() => onOpenDocs([{ id: `${r.step.id}:cert`, name: r.certName!, type: 'PDF', from: 'firm', kind: 'milestone', ref: r.certPath! }], 0)}>
                  <I n="clip" s={12} />
                  Proof
                </button>
              ) : (
                <span className="pr pend" title="Filed, proof not uploaded yet">
                  Proof pending
                </span>
              )
            ) : null}
            {r.portal ? (
              <a className="ic" href={r.portal} target="_blank" rel="noopener noreferrer" aria-label="Open the official portal">
                <I n="ext" s={14} />
              </a>
            ) : null}
          </div>
        );
      })}
    </Card>
  );

  const postCard = (
    <Card id="post" title="Post-incorporation setup" info="Statutory windows that started on the COI date.">
      {h.post.open.map((p) => {
        const pct = Math.round(p.usedPct);
        return (
          <button key={p.step.id} className="row" type="button" onClick={() => drill('Post-incorporation setup', [['Open', h.post.open.length], ['Completed', h.post.done.length]], 0, postRows)}>
            <span className="t">
              <b>{p.step.title}</b>
              <span>
                {p.owner === 'client' ? company : 'SBC'} · {p.dueDate ? dShort(p.dueDate) : '—'}
                {p.overDays ? (
                  <i style={{ color: 'var(--over-text)', fontWeight: 700, fontStyle: 'normal', display: 'inline' }}> · overdue {p.overDays} day{p.overDays === 1 ? '' : 's'}</i>
                ) : p.limitDays && p.day != null ? (
                  ` · day ${p.day} of ${p.limitDays}`
                ) : (
                  ''
                )}
              </span>
              <span style={{ display: 'flex', marginTop: 5 }}>
                <span className="pb">
                  <i style={{ width: `${pct}%`, background: p.overDays ? 'var(--over)' : pct > 45 ? 'var(--due)' : 'var(--navy-3)' }} />
                </span>
              </span>
            </span>
          </button>
        );
      })}
      {h.post.open.length === 0 ? <Bot text="Every post-incorporation step is done." act="" /> : null}
    </Card>
  );

  const docsCard = (
    <Card id="docs" title="Recent documents" info={`The newest files from ${company}’s project. 👁 previews, ⬇ downloads.`} foot={['Open Documents', () => portal.go('documents')]}>
      {h.docs.length ? (
        h.docs.map((d, i) => (
          <div key={d.id} className="row" style={{ cursor: 'default' }}>
            <span className="mono" style={{ width: 38, height: 20, borderRadius: 3, background: FT_PHONE[d.type] ?? 'var(--subtle)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', flex: 'none' }}>
              {d.type}
            </span>
            <span className="t">
              <b>{d.name}</b>
              <span>{dShort(d.date)}</span>
            </span>
            <button className="ic" type="button" aria-label={`Preview ${d.name}`} onClick={() => onOpenDocs(h.docs, i)}>
              <I n="eye" s={15} />
            </button>
            <button className="ic" type="button" aria-label={`Download ${d.name}`} onClick={() => void download(d)}>
              <I n="dl" s={15} />
            </button>
          </div>
        ))
      ) : (
        <Bot text={`No documents yet. Files from ${company} and SBC show up here.`} act="" />
      )}
    </Card>
  );

  const actCard = (
    <Card id="act" title="Recent activity" info="Who did what, newest first.">
      <MSeg
        id="act"
        tabs={[
          ['All', acts.length],
          ['SBC', acts.filter((a) => a.actorKind !== 'client').length],
          [company, acts.filter((a) => a.actorKind === 'client').length],
        ]}
        sel={actTab}
        onSel={setActTab}
      />
      <div>
        {actRows.length ? (
          actRows.map((a) => (
            <div key={a.id} className="row" style={{ cursor: 'default' }}>
              <Si k={a.actorKind === 'client' ? 'you' : a.actorKind === 'system' ? 'late' : 'done'} tip={a.actorKind === 'client' ? company : a.actorName} />
              <span className="t">
                <b>{a.label}</b>
                <span>
                  {dShort(a.at.slice(0, 10))} · {a.actorKind === 'client' ? company : a.actorName}
                </span>
              </span>
            </div>
          ))
        ) : (
          <Bot text="Nothing here yet." act="" />
        )}
      </div>
    </Card>
  );

  const cards = after
    ? [needsCard, nextCard, compCard, idsCard, regsCard, postCard, sbcCard, timelineCard, docsCard, actCard]
    : [needsCard, holdsCard, timelineCard, alertsCard, sbcCard, docsCard, actCard];

  return (
    <div className="cp-home-m">
      <div className={`app${ready ? '' : ' sk'}`}>
        <main className="wrap">
          {[greet, ...cards].map((c, i) => (
            <StaggerSlot key={i} i={i} drawn={drawn}>
              {c}
            </StaggerSlot>
          ))}
        </main>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          const n = upTarget.current;
          if (f && n?.requestId) {
            closeSheet();
            void uploadFile(n, f);
          }
        }}
      />
      <div className={`scrim${sheet ? ' on' : ''}`} onClick={closeSheet} />
      <section className={`sheet${sheet ? ' on' : ''}`} role="dialog" aria-modal="true" aria-labelledby="m-shT" aria-hidden={!sheet}>
        <div className="grab">
          <i />
        </div>
        <div className="sh">
          <h3 id="m-shT">{sheet?.title}</h3>
          <button ref={xRef} className="ib" type="button" aria-label="Close" onClick={closeSheet}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="body">{sheet?.body}</div>
      </section>
      {reveal ? <IdsRevealDialog field={reveal} onClose={() => setReveal(null)} /> : null}
    </div>
  );

  async function uploadFile(n: NeedRow, f: File) {
    const fd = new FormData();
    fd.append('file', f);
    const res = await fetch(`/api/client/home/needs/${encodeURIComponent(n.requestId!)}/upload`, { method: 'POST', body: fd });
    const body = (await res.json().catch(() => ({}))) as { documentId?: string; error?: string };
    if (!res.ok || !body.documentId) return portal.toast(body.error ?? 'Upload failed. Try again.');
    h.refetch();
    portal.toast(`Uploaded · ${n.title}`, {
      undo: () => void fetch(`/api/client/home/needs/${encodeURIComponent(n.requestId!)}/upload?documentId=${encodeURIComponent(body.documentId!)}`, { method: 'DELETE' }).then(() => h.refetch()),
    });
  }
}

/** Sets the stagger delay + draw-in class on the card element itself (`.wrap>*`). */
function StaggerSlot({ i, drawn, children }: { i: number; drawn: boolean; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current?.nextElementSibling as HTMLElement | null;
    if (!el) return;
    el.style.animationDelay = `${i * 0.06}s`;
    el.classList.toggle('in', drawn);
  });
  return (
    <>
      <span ref={ref} hidden />
      {children}
    </>
  );
}
