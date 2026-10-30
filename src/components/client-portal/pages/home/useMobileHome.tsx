import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { portalHref, stepHref } from '@/components/client-portal/routes';
import { useMultiUpload } from '@/components/client-portal/use-multi-upload';
import {
  useRevealedIdentifier,
} from '@/components/client-portal/pages/credentials/IdsRevealDialog';
import type { PortalStep } from '@/lib/client-portal/step-model';
import type { HomeData } from './useHome';
import { buildSbcRows, overdueCount } from './CardsA';
import { useDownload } from './ui';
import {
  BUCKET_LABEL,
  BUCKETS,
  bucketOf,
  dShort,
  days,
  filingName,
  timelineAxis,
  type DocItem,
  type NeedRow,
  type RegRow,
  type TlPhase,
} from './derive';
import { I, stepK, type DRow, SheetDrill } from './MobileParts';

export interface MobileHomeProps {
  h: HomeData;
  onEditTimeline: () => void;
  phases: TlPhase[] | null;
  onOpenDocs: (docs: DocItem[], i: number) => void;
}

/**
 * State and drills behind the phone Home: skeleton and draw-in timing, the
 * bottom sheet, every drill (steps, due, docs, registrations, SBC,
 * compliance), the needs upload flow, identifier reveal and activity tabs.
 */
export function useMobileHome({ h, onEditTimeline, phases, onOpenDocs }: MobileHomeProps) {
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
        { v: h.regs.length ? `${regsDone}/${h.regs.length}` : regsDone, l: 'Registrations', on: () => regDrill(0) },
        { v: h.overview?.engagement.incorporationDate ? dShort(h.overview.engagement.incorporationDate) : 'Not yet', l: 'Incorporated', on: () => portal.go('incorporation') },
      ]
    : [
        // B1: the same five tiles in the same order as the desktop home card.
        { v: h.needs.length, l: `Waiting on ${company}`, on: () => stepsDrill(1) },
        { v: overdueCount(h), l: 'Overdue', on: () => dueDrill(0) },
        { v: model.counts.with, l: 'With SBC', on: () => stepsDrill(2) },
        { v: reqC && reqC.total ? `${reqC.fulfilled}/${reqC.total}` : 0, l: 'Documents in', on: () => docsDrill() },
        { v: `${model.spice.done}/${model.spice.total}`, l: 'Steps done', on: () => stepsDrill(0) },
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
    // G-07: directors' DINs
    ...(ids.dins ?? []).map((d): [string, string | undefined, 'pan' | 'tan' | null, string, string | null] => [`DIN · ${d.name}`, d.din, null, 'https://www.mca.gov.in', null]),
  ];

  /* ----------------------------------------------------------- docs */
  const download = useDownload();
  const [actTab, setActTab] = useState(0);
  const acts = h.home?.activity ?? [];
  const actRows = acts.filter((a) => actTab === 0 || (actTab === 1 ? a.actorKind !== 'client' : a.actorKind === 'client'));


  // G-09: several files in one request, each with its own row in the tray
  const up = useMultiUpload();
  async function uploadFile(n: NeedRow, f: File | File[]) {
    const files = Array.isArray(f) ? f : [f];
    if (!files.length) return;
    const url = `/api/client/home/needs/${encodeURIComponent(n.requestId!)}/upload`;
    const res = await up.send(url, files);
    const docId = typeof res.body.documentId === 'string' ? res.body.documentId : null;
    if (!res.ok || !docId) return portal.toast(res.body.error ?? 'Upload failed. Try again.');
    h.refetch();
    const refused = res.body.rejected?.length ?? 0;
    if (!refused) setTimeout(up.clear, 2400);
    portal.toast(files.length === 1 ? `Uploaded · ${n.title}` : `Uploaded ${files.length - refused} of ${files.length} files · ${n.title}`, {
      undo: () => {
        up.clear();
        void fetch(`${url}?documentId=${encodeURIComponent(docId)}`, { method: 'DELETE' }).then(() => h.refetch());
      },
    });
  }

  return {
    h,
    onEditTimeline,
    phases,
    onOpenDocs,
    portal,
    model,
    company,
    after,
    today,
    ready,
    setReady,
    drawn,
    setDrawn,
    sheet,
    setSheet,
    last,
    xRef,
    openSheet,
    closeSheet,
    goR,
    drill,
    spice,
    stepSub,
    groupsOf,
    stepsDrill,
    groupIdx,
    openF,
    overRows,
    soonRows,
    dueDrill,
    C,
    post,
    ring,
    regsDone,
    reqC,
    stats,
    docsDrill,
    regDrill,
    reportHref,
    needTab,
    setNeedTab,
    NT,
    fileRef,
    upTarget,
    uploadSheet,
    pickFile,
    needAct,
    needRows,
    idx,
    doneBefore,
    around,
    more,
    cur,
    ph1,
    gantt,
    sbc,
    sbcDrill,
    nextTab,
    setNextTab,
    nextList,
    c15,
    c30,
    total,
    compCols,
    compDrill,
    reveal,
    setReveal,
    panR,
    tanR,
    ids,
    idRows,
    download,
    actTab,
    setActTab,
    acts,
    actRows,
    uploadFile,
    upload: up,
  };
}

export type MobileHomeState = ReturnType<typeof useMobileHome>;
