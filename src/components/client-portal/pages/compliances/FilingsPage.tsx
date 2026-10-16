'use client';

/**
 * Compliances · Filings — prototype s/comp/index.html #fil-redesign: FY stepper,
 * cadence pill, Export (CSV), Calendar link; donut + "By area" stacked bars
 * (every part drills down); area + status pills (they DO filter this table);
 * two-month window ‹ › with "Full year"; table with date tiles, ↗, 📎 Proof /
 * Proof pending; row → right side panel (F-10).
 *
 * URL state: ?fy= · ?cadence=monthly|quarterly|annual · ?area= · ?status=
 * all|over|due|up|ok · ?period=YYYY-MM (window end month) · ?view=year · ?filing=<id>.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { usePortal } from '../../PortalProvider';
import { BotSays } from '../../shared';
import { portalHref } from '../../routes';
import {
  AREAS,
  AREA_LABEL,
  AREA_ORDER,
  MON,
  daysBetween,
  filterArea,
  fmtDM,
  fyLabelOf,
  fyMonths,
  fyStartOfMonth,
  plural,
  sortByDue,
  statusOf,
  stepMonth,
  tileVar,
  todayIso,
  type AreaFilter,
  type CompStatus,
  type PortalFiling,
} from '@/lib/client-portal/compliances';
import { fetchProofs, proofHref, useCompFilings, useDownload } from './api';
import { AreaChip, Chip, I, NameWithLinks, ProofChip, Seg, usePageTips } from './bits';
import { CompProvider, useComp } from './ctx';
import { DonutCard } from './DonutCard';
import { SidePanel } from './Detail';
import '../../css/compliances-board.css';

const CADENCES = ['monthly', 'quarterly', 'annual'] as const;
type Cadence = (typeof CADENCES)[number];
const CAD_FREQ: Record<Cadence, string[]> = { monthly: ['monthly'], quarterly: ['quarterly', 'half-yearly'], annual: ['annual', 'one-time'] };
const STATUS_TABS: ['all' | CompStatus, string, string | null][] = [
  ['all', 'All', null],
  ['over', 'Overdue', 'var(--over)'],
  ['due', 'Due soon', 'var(--due)'],
  ['up', 'Upcoming', 'var(--up)'],
  ['ok', 'Filed', 'var(--ok)'],
];

function useFilingsState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = todayIso();
  const nowKey = today.slice(0, 7);
  const curFy = fyStartOfMonth(nowKey);
  const fyP = Number.parseInt(params.get('fy') ?? '', 10);
  const fy = Number.isInteger(fyP) && fyP >= 2000 && fyP <= curFy + 2 ? fyP : curFy;
  const cadP = params.get('cadence');
  const cadence: Cadence = (CADENCES as readonly string[]).includes(cadP ?? '') ? (cadP as Cadence) : 'monthly';
  const areaP = (params.get('area') ?? 'all').toUpperCase();
  const area: AreaFilter = areaP === 'ALL' ? 'all' : AREAS.some((a) => a.id === areaP) ? (areaP as AreaFilter) : 'all';
  const stP = params.get('status');
  const status = (STATUS_TABS.some((t) => t[0] === stP) ? stP : 'all') as 'all' | CompStatus;
  const months = fyMonths(fy);
  const perP = params.get('period');
  // window end month: ?period, else today's month (inside the FY), else the FY's first month + 1
  const end = perP && months.includes(perP) && months.indexOf(perP) > 0 ? perP : months.includes(nowKey) && months.indexOf(nowKey) > 0 ? nowKey : months[1]!;
  const fullYear = params.get('view') === 'year';
  const filing = params.get('filing') ?? params.get('open');
  const set = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'filing') next.delete('open');
        if (v == null || v === '' || (k === 'area' && v === 'all') || (k === 'status' && v === 'all')) next.delete(k);
        else next.set(k, k === 'area' ? v.toLowerCase() : v);
      }
      const q = next.toString();
      router.replace(`${pathname}${q ? `?${q}` : ''}`, { scroll: false });
    },
    [params, router, pathname],
  );
  return { today, nowKey, curFy, fy, cadence, area, status, end, months, fullYear, filing, set };
}

export function CompliancesFilings() {
  const st = useFilingsState();
  const tableRef = useRef<HTMLDivElement>(null);
  return (
    <div className="cp-compliances">
      <CompProvider
        today={st.today}
        onDrillRow={(f) => st.set({ filing: f.id })}
        drillLink={{ text: 'Show in the Filings list ↓', onClick: () => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
      >
        <FilingsBody st={st} tableRef={tableRef} />
      </CompProvider>
    </div>
  );
}

function FilingsBody({ st, tableRef }: { st: ReturnType<typeof useFilingsState>; tableRef: React.RefObject<HTMLDivElement | null> }) {
  const { after, go, toast } = usePortal();
  const { today, openProof, openDrill } = useComp();
  const download = useDownload();
  const root = useRef<HTMLDivElement>(null);
  usePageTips(root);
  const { fy, cadence, area, status, end, months, fullYear, set } = st;
  const q = useCompFilings(fy, after);
  const all = useMemo(() => (after ? q.data?.rows ?? [] : []), [after, q.data]);
  const start = stepMonth(end, -1);
  const winLabel = fullYear
    ? fyLabelOf(fy)
    : start.slice(0, 4) === end.slice(0, 4)
      ? `${MON[Number(start.slice(5)) - 1]} – ${MON[Number(end.slice(5)) - 1]} ${end.slice(0, 4)}`
      : `${MON[Number(start.slice(5)) - 1]} ${start.slice(0, 4)} – ${MON[Number(end.slice(5)) - 1]} ${end.slice(0, 4)}`;
  const winShort = fullYear ? fyLabelOf(fy) : `${MON[Number(start.slice(5)) - 1]}–${MON[Number(end.slice(5)) - 1]}`;

  const inView = useMemo(() => {
    const cad = all.filter((r) => CAD_FREQ[cadence].includes(r.frequency.toLowerCase()));
    return fullYear ? cad : cad.filter((r) => r.dueDate >= `${start}-01` && r.dueDate <= `${end}-31`);
  }, [all, cadence, fullYear, start, end]);
  const table = useMemo(
    () => sortByDue(filterArea(inView, area).filter((r) => status === 'all' || statusOf(r, today) === status)),
    [inView, area, status, today],
  );
  const detail = st.filing ? all.find((r) => r.id === st.filing) ?? null : null;
  // deep link to a filing outside the FY in view (?filing= / ?open=): look it up and jump to its FY
  const missing = Boolean(st.filing) && after && q.isSuccess && !detail;
  const lookup = useQuery({
    queryKey: ['client-compliances', 'one', st.filing],
    enabled: missing,
    queryFn: async () => {
      const res = await fetch(`/api/client/compliances?id=${encodeURIComponent(st.filing!)}`, { cache: 'no-store' });
      if (!res.ok) return null;
      return ((await res.json()) as { rows: PortalFiling[] }).rows[0] ?? null;
    },
  });
  useEffect(() => {
    if (!missing || lookup.isLoading) return;
    const f = lookup.data;
    if (f) {
      const ffy = fyStartOfMonth(f.dueDate.slice(0, 7));
      if (ffy !== fy) set({ fy: String(ffy), period: null, filing: f.id });
    } else if (lookup.isFetched) {
      set({ filing: null });
      toast('That filing is not in your register');
    }
  }, [missing, lookup.isLoading, lookup.data, lookup.isFetched, fy, set, toast]);
  const drillTitle = `Filings · ${fullYear ? fyLabelOf(fy) : winLabel.replace(' – ', '–')}`;

  const exportHref = `/api/client/compliances/export?fy=${fy}&cadence=${cadence}&area=${area}&status=${status}`;
  const canPrev = !fullYear && months.indexOf(start) > 0;
  const canNext = !fullYear && months.indexOf(end) < 11;

  const downloadPrimary = (f: PortalFiling) => {
    fetchProofs(f.id)
      .then((p) => {
        if (!p.length) return toast('Proof pending · SBC will upload it');
        download(proofHref(f.id, p[0]!.id));
        toast(`Download started · ${p[0]!.fileName}`);
      })
      .catch(() => toast('Could not download the proof'));
  };

  return (
    <div className="cp-comp-root page stag" ref={root}>
      {/* header (F-01) */}
      <div className="row-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, padding: 2 }}>
          <button type="button" className="ibtn" style={{ border: 0, width: 28, height: 28 }} aria-label="Previous financial year" onClick={() => set({ fy: String(fy - 1), period: null, filing: null })}>
            {I.chevL(15)}
          </button>
          <b className="mono" style={{ fontSize: 12, minWidth: 84, textAlign: 'center' }}>
            {fyLabelOf(fy)}
          </b>
          <button
            type="button"
            className="ibtn"
            style={{ border: 0, width: 28, height: 28 }}
            aria-label="Next financial year"
            disabled={fy >= st.curFy + 2}
            onClick={() => set({ fy: String(fy + 1), period: null, filing: null })}
          >
            {I.chevR(15)}
          </button>
        </div>
        <div className="end" style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="seg-scroll">
            <Seg
              opts={['Monthly', 'Quarterly', 'Annual']}
              on={CADENCES.indexOf(cadence)}
              label="Frequency"
              onPick={(i) => set({ cadence: CADENCES[i]! })}
              same={(i) => toast(`Already showing ${['monthly', 'quarterly', 'annual'][i]} filings`)}
            />
          </div>
          <button
            type="button"
            className="btn btn-o btn-s"
            disabled={!after}
            onClick={() => {
              download(exportHref);
              toast(`Download started · ${fyLabelOf(fy)} filings (CSV)`);
            }}
          >
            {I.down(14)} Export
          </button>
          <a
            className="btn btn-o btn-s"
            style={{ color: 'var(--navy-ink,var(--navy))' }}
            href={portalHref('compliances')}
            onClick={(e) => {
              e.preventDefault();
              go(`${portalHref('compliances')}${fullYear ? '' : `?date=${end}`}`);
            }}
          >
            {I.cal(14)} Calendar
          </a>
        </div>
      </div>

      {!after ? (
        <div className="card" style={{ padding: 24, display: 'grid', placeItems: 'center' }}>
          <BotSays size={56} question="Why are there no filings before incorporation?">
            Your filings start after incorporation.
            <br />
            Nothing is due yet.
          </BotSays>
        </div>
      ) : q.isError ? (
        <div className="card" role="alert" style={{ padding: 18, color: 'var(--over-text)', fontWeight: 700 }}>
          Could not load the register.{' '}
          <button type="button" className="btn btn-o btn-s" onClick={() => void q.refetch()}>
            Try again
          </button>
        </div>
      ) : q.isLoading ? (
        <div className="card" style={{ padding: '14px 16px' }} aria-busy="true" aria-label="Loading filings">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div className="sk-row" style={{ width: 38, height: 42, borderRadius: 8 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
                <div className="sk-row" style={{ height: 10, borderRadius: 4, width: '60%' }} />
                <div className="sk-row" style={{ height: 10, borderRadius: 4, width: '35%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : !all.length ? (
        <div className="card" style={{ padding: 24, display: 'grid', placeItems: 'center' }}>
          <BotSays size={48} question={`Why are there no filings for ${fyLabelOf(fy)}?`}>
            No filings yet for {fyLabelOf(fy)}.
            <br />
            They appear as each registration goes live.
          </BotSays>
        </div>
      ) : (
        <>
          {/* KPIs (F-02, F-03) */}
          <div className="fil-kpis" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }}>
            <DonutCard rows={inView} label="filings" drillTitle={drillTitle} />
            <AreaBars rows={inView} title={`By area · ${winShort}`} drillTitle={drillTitle} openDrill={openDrill} />
          </div>

          {/* filters (F-04) */}
          <div className="row-wrap" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="seg-scroll">
              <Seg
                opts={AREAS.map((a) => a.label)}
                on={Math.max(0, AREAS.findIndex((a) => a.id === area))}
                counts={AREAS.map((a) => (a.id === 'all' ? inView.length : inView.filter((r) => r.area === a.id).length))}
                label="Area"
                onPick={(i) => set({ area: AREAS[i]!.id })}
                same={(i) => toast(`Already showing ${AREAS[i]!.label === 'All' ? 'all areas' : AREAS[i]!.label}`)}
              />
            </div>
            <div className="end seg-scroll" style={{ marginLeft: 'auto' }}>
              <Seg
                opts={STATUS_TABS.map((t) => t[1])}
                dots={STATUS_TABS.map((t) => t[2])}
                on={Math.max(0, STATUS_TABS.findIndex((t) => t[0] === status))}
                label="Status"
                onPick={(i) => set({ status: STATUS_TABS[i]![0] })}
                same={(i) => toast(`Already showing ${STATUS_TABS[i]![1].toLowerCase()} filings`)}
              />
            </div>
          </div>

          {/* table (F-05, F-06) */}
          <div className="card" style={{ overflow: 'hidden' }} ref={tableRef}>
            <div className="fil-head" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              {!fullYear ? (
                <button type="button" className="ibtn" style={{ border: 0 }} aria-label="Earlier months" disabled={!canPrev} onClick={() => set({ period: stepMonth(end, -1) })}>
                  {I.chevL(15)}
                </button>
              ) : null}
              <b style={{ font: "700 15px 'Space Grotesk'" }}>{winLabel}</b>
              {!fullYear ? (
                <button type="button" className="ibtn" style={{ border: 0 }} aria-label="Later months" disabled={!canNext} onClick={() => set({ period: stepMonth(end, 1) })}>
                  {I.chevR(15)}
                </button>
              ) : null}
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                {plural(table.length, 'filing')}
              </span>
              <button
                type="button"
                className={`btn btn-s ${fullYear ? 'btn-n' : 'btn-o'}`}
                style={{ marginLeft: 'auto' }}
                aria-pressed={fullYear}
                onClick={() => set({ view: fullYear ? null : 'year' })}
              >
                Full year
              </button>
            </div>
            {table.length ? (
              <div className="tbl-scroll">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 56 }}>Due</th>
                      <th style={{ width: 70 }}>Area</th>
                      <th>Filing</th>
                      <th>Frequency</th>
                      <th>Filed on</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((r) => (
                      <FilRow key={r.id} r={r} today={today} onOpen={() => set({ filing: r.id })} onProof={openProof} onDownload={downloadPrimary} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '22px 18px' }}>
                <BotSays size={44} action={status === 'over' ? '' : 'Ask VCFO why'} question={`Why are there no ${status === 'all' ? '' : `${STATUS_TABS.find((t) => t[0] === status)![1].toLowerCase()} `}filings in ${winLabel}?`}>
                  {status === 'over' ? 'Nothing overdue. Nice work.' : 'No filings here yet.'}
                </BotSays>
              </div>
            )}
          </div>
        </>
      )}

      {detail ? <SidePanel f={detail} onClose={() => set({ filing: null })} /> : null}
    </div>
  );
}

function FilRow({
  r,
  today,
  onOpen,
  onProof,
  onDownload,
}: {
  r: PortalFiling;
  today: string;
  onOpen: () => void;
  onProof: (f: PortalFiling) => void;
  onDownload: (f: PortalFiling) => void;
}) {
  const s = statusOf(r, today);
  const left = daysBetween(today, r.dueDate);
  return (
    <tr
      data-id={r.id}
      tabIndex={0}
      aria-label={`${r.name} · ${r.period} · open the details`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <td>
        <div className="dtile" style={{ width: 38, height: 42, background: tileVar(s) }}>
          <b style={{ fontSize: 15 }}>{Number(r.dueDate.slice(8))}</b>
          <small>{MON[Number(r.dueDate.slice(5, 7)) - 1]}</small>
        </div>
      </td>
      <td>
        <AreaChip a={r.area} />
      </td>
      <td>
        <div style={{ fontWeight: 700, fontSize: 13 }}>
          <NameWithLinks f={r} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.period}</div>
      </td>
      <td style={{ color: 'var(--muted)' }}>{r.freqLabel}</td>
      <td>
        {r.filedOn ? (
          <span style={{ fontWeight: 600 }}>{fmtDM(r.filedOn)}</span>
        ) : s === 'over' ? (
          <span style={{ color: 'var(--over-text)', fontWeight: 700 }}>{plural(-left, 'day')} late</span>
        ) : (
          <span style={{ color: 'var(--muted)' }}>{left === 0 ? 'today' : `in ${plural(left, 'day')}`}</span>
        )}
      </td>
      <td>
        <Chip s={s} />
      </td>
      <td style={{ textAlign: 'right' }}>
        {r.filedOn ? (
          r.proofCount === 0 ? (
            <ProofChip f={r} onOpen={onProof} />
          ) : (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <ProofChip f={r} onOpen={onProof} />
              <button
                type="button"
                className="ibtn"
                data-tip="Download"
                aria-label="Download proof"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(r);
                }}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {I.down(15)}
              </button>
            </span>
          )
        ) : (
          <span style={{ color: 'var(--subtle)', fontSize: 11 }}>—</span>
        )}
      </td>
    </tr>
  );
}

function AreaBars({
  rows,
  title,
  drillTitle,
  openDrill,
}: {
  rows: PortalFiling[];
  title: string;
  drillTitle: string;
  openDrill: ReturnType<typeof useComp>['openDrill'];
}) {
  const { today } = useComp();
  const open = (a: string) => openDrill({ kind: 'area', k: a, title: drillTitle, rows });
  const key = (a: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open(a);
    }
  };
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <p className="st" style={{ marginBottom: 2 }}>
        {title}
      </p>
      {AREA_ORDER.map((a) => {
        const rs = rows.filter((r) => r.area === a);
        const f = rs.filter((r) => r.filedOn).length;
        const o = rs.filter((r) => statusOf(r, today) === 'over').length;
        const d = rs.filter((r) => statusOf(r, today) === 'due').length;
        const u = rs.length - f - o - d;
        const L = AREA_LABEL[a];
        const part = (n: number, bg: string, tip: string) =>
          n ? (
            <span data-dd="area" data-tip={`${L} · ${n} ${tip}`} role="button" tabIndex={-1} aria-label={`${L} · ${n} ${tip}`} style={{ flex: n, background: bg }} onClick={() => open(a)} onKeyDown={key(a)} />
          ) : null;
        return (
          <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              data-dd="area"
              data-tip={`${L} · ${plural(rs.length, 'filing')}`}
              role="button"
              tabIndex={0}
              aria-label={`${L} · ${plural(rs.length, 'filing')} · show the list`}
              style={{ width: 74, flex: 'none', fontSize: 12, fontWeight: 700, borderRadius: 4 }}
              onClick={() => open(a)}
              onKeyDown={key(a)}
            >
              {L}
            </span>
            <span style={{ flex: 1, display: 'flex', gap: 2, height: 12, borderRadius: 4, overflow: 'hidden', background: 'var(--raised)' }}>
              {part(f, 'var(--ok)', 'filed')}
              {part(o, 'var(--over)', 'overdue')}
              {part(d, 'var(--due)', 'due soon')}
              {u || !rs.length ? (
                <span data-dd="area" data-tip={`${L} · ${u} upcoming`} role="button" tabIndex={-1} aria-label={`${L} · ${u} upcoming`} style={{ flex: u || 1, background: rs.length ? 'var(--up)' : 'transparent' }} onClick={() => open(a)} onKeyDown={key(a)} />
              ) : null}
            </span>
            <span className="mono" style={{ width: 34, flex: 'none', textAlign: 'right', fontSize: 11, color: 'var(--muted)' }}>
              {f}/{rs.length}
            </span>
          </div>
        );
      })}
    </div>
  );
}
