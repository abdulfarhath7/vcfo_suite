'use client';

/**
 * Compliances · Filings (VCFO Spectrum FilingsScreen): the status donut and progress by area
 * (every part drills down), then the T1 grid with every filter in its head bar (R-08): the
 * two-month window with Full year, the frequency switch, the Area and Status filter chips,
 * the FY stepper, Export (CSV) and the calendar link. A row opens the right side panel (F-10).
 *
 * URL state: ?fy= · ?cadence=monthly|quarterly|annual · ?area= · ?status=
 * all|over|due|up|ok · ?period=YYYY-MM (window end month) · ?view=year · ?filing=<id>.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { SkeletonRows } from '@/components/ui/empty-state';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { usePortal } from '../../PortalProvider';
import { portalHref } from '../../routes';
import {
  AREAS,
  AREA_LABEL,
  AREA_ORDER,
  MON,
  filterArea,
  fyLabelOf,
  fyMonths,
  fyStartOfMonth,
  plural,
  sortByDue,
  statusOf,
  stepMonth,
  todayIso,
  type AreaCode,
  type AreaFilter,
  type CompStatus,
  type PortalFiling,
} from '@/lib/client-portal/compliances';
import { fetchProofs, proofHref, useCompFilings, useDownload } from './api';
import { usePageTips } from './bits';
import { CompProvider, useComp } from './ctx';
import { DonutCard } from './DonutCard';
import { SidePanel } from './Detail';
import { AreaTag, DateTile, Empty, FILL, FilterMenu, Island, PortalLink, STATUS_ORDER, StatusChip, WORD } from './spectrum';
import { FiledCell, ProofCell } from './cells';
import '../../css/compliances-board.css';

const CADENCES = ['monthly', 'quarterly', 'annual'] as const;
type Cadence = (typeof CADENCES)[number];
const CAD_FREQ: Record<Cadence, string[]> = { monthly: ['monthly'], quarterly: ['quarterly', 'half-yearly'], annual: ['annual', 'one-time'] };
const STATUS_KEYS: ('all' | CompStatus)[] = ['all', 'over', 'due', 'up', 'ok'];

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
  const status = (STATUS_KEYS.includes(stP as 'all' | CompStatus) ? stP : 'all') as 'all' | CompStatus;
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
  const cadSet = cadP === cadence;
  return { today, nowKey, curFy, fy, cadence, cadSet, area, status, end, months, fullYear, filing, set };
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
  const { after, go, toast, openChat } = usePortal();
  const { today, openProof, openDrill } = useComp();
  const download = useDownload();
  const root = useRef<HTMLDivElement>(null);
  usePageTips(root);
  const { fy, area, status, end, months, fullYear, set } = st;
  const q = useCompFilings(fy, after);
  const all = useMemo(() => (after ? q.data?.rows ?? [] : []), [after, q.data]);
  const start = stepMonth(end, -1);
  // no ?cadence: open on the first cadence that has filings in the window, so the
  // page never opens on an empty Monthly view when the register has none (CP-05)
  const cadence: Cadence = useMemo(() => {
    if (st.cadSet || !all.length) return st.cadence;
    const inWin = (r: PortalFiling) => fullYear || (r.dueDate >= `${start}-01` && r.dueDate <= `${end}-31`);
    return CADENCES.find((c) => all.some((r) => CAD_FREQ[c].includes(r.frequency.toLowerCase()) && inWin(r))) ?? st.cadence;
  }, [st.cadSet, st.cadence, all, fullYear, start, end]);
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
  const calHref = `${portalHref('compliances')}${fullYear ? '' : `?date=${end}`}`;

  const downloadPrimary = (f: PortalFiling) => {
    fetchProofs(f.id)
      .then((p) => {
        if (!p.length) return toast('Proof pending · SBC will upload it');
        download(proofHref(f.id, p[0]!.id));
        toast(`Download started · ${p[0]!.fileName}`);
      })
      .catch(() => toast('Could not download the proof'));
  };
  const open = (f: PortalFiling) => set({ filing: f.id });
  const statusWord = status === 'all' ? '' : WORD[status].toLowerCase();

  const columns: EFilingColumn<PortalFiling>[] = [
    { key: 'due', header: 'Due', width: '64px', render: (r) => <DateTile iso={r.dueDate} s={statusOf(r, today)} size="sm" /> },
    { key: 'area', header: 'Area', width: '124px', render: (r) => <AreaTag a={r.area} /> },
    {
      key: 'name',
      header: 'Filing',
      width: '30%',
      render: (r) => (
        <span className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            className="min-w-0 text-left"
            aria-label={`${r.name} · ${r.period} · open the details`}
            onClick={(e) => {
              e.stopPropagation();
              open(r);
            }}
          >
            <span className="block truncate font-medium leading-tight text-ink">{r.name}</span>
            <span className="block truncate text-[12.5px] leading-tight text-ink-muted">{r.period}</span>
          </button>
          <PortalLink f={r} />
        </span>
      ),
    },
    { key: 'freq', header: 'Frequency', width: '112px', render: (r) => <span className="text-ink-muted">{r.freqLabel}</span> },
    { key: 'filed', header: 'Filed on', width: '120px', render: (r) => <FiledCell r={r} today={today} /> },
    { key: 'status', header: 'Status', width: '128px', render: (r) => <StatusChip s={statusOf(r, today)} /> },
    { key: 'proof', header: 'Proof', width: '136px', align: 'right', render: (r) => <ProofCell r={r} onProof={openProof} onDownload={downloadPrimary} /> },
  ];

  const headBar = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-soft px-4 py-2.5 md:px-5">
      <h2 className="text-[15px] font-medium text-ink">Filings</h2>
      {after && all.length ? <span className="rounded-sm bg-surface-sunken px-[7px] py-px text-[12px] font-medium text-ink-2">{table.length}</span> : null}
      <span className="inline-flex h-[30px] items-center overflow-hidden rounded-md border-1.5 border-line-strong bg-surface-raised">
        <button type="button" className="grid h-7 w-7 place-items-center text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-40" aria-label="Earlier months" disabled={!canPrev} onClick={() => set({ period: stepMonth(end, -1) })}>
          <ChevronLeft size={15} strokeWidth={1.6} aria-hidden />
        </button>
        <b className="whitespace-nowrap px-1 text-center text-[13px] font-medium text-ink" aria-live="polite">
          {winLabel}
        </b>
        <button type="button" className="grid h-7 w-7 place-items-center text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-40" aria-label="Later months" disabled={!canNext} onClick={() => set({ period: stepMonth(end, 1) })}>
          <ChevronRight size={15} strokeWidth={1.6} aria-hidden />
        </button>
        <button
          type="button"
          aria-pressed={fullYear}
          onClick={() => set({ view: fullYear ? null : 'year' })}
          className={cn('h-full whitespace-nowrap border-l-1.5 border-line-strong px-2.5 text-[13px] font-medium', fullYear ? 'bg-brand-soft text-brand-text' : 'text-ink-2 hover:bg-surface-sunken')}
        >
          Full year
        </button>
      </span>
      <SpectrumTabs
        label="Frequency"
        size="md"
        value={cadence}
        onChange={(k) => (k === cadence ? toast(`Already showing ${k} filings`) : set({ cadence: k }))}
        items={CADENCES.map((c) => ({ key: c, label: c[0]!.toUpperCase() + c.slice(1) }))}
      />
      <FilterMenu
        label="Area"
        value={area === 'all' ? null : area}
        onChange={(v) => set({ area: v ?? 'all' })}
        options={AREAS.filter((a) => a.id !== 'all').map((a) => ({ value: a.id as AreaCode, label: a.label, count: inView.filter((r) => r.area === a.id).length }))}
      />
      <FilterMenu
        label="Status"
        value={status === 'all' ? null : status}
        onChange={(v) => set({ status: v ?? 'all' })}
        options={STATUS_ORDER.map((s) => ({ value: s, label: WORD[s], count: filterArea(inView, area).filter((r) => statusOf(r, today) === s).length }))}
      />
      {area !== 'all' || status !== 'all' ? (
        <button type="button" className="text-[13px] font-medium text-brand-text hover:underline" onClick={() => set({ area: 'all', status: 'all' })}>
          Clear filters
        </button>
      ) : null}
      <span className="ml-auto flex items-center gap-2">
        <span className="inline-flex h-[30px] items-center overflow-hidden rounded-md border-1.5 border-line-strong bg-surface-raised">
          <button type="button" className="grid h-7 w-7 place-items-center text-ink-muted hover:bg-surface-sunken hover:text-ink" aria-label="Previous financial year" onClick={() => set({ fy: String(fy - 1), period: null, filing: null })}>
            <ChevronLeft size={15} strokeWidth={1.6} aria-hidden />
          </button>
          <b className="min-w-[84px] text-center text-[13px] font-medium tabular-nums text-ink">{fyLabelOf(fy)}</b>
          <button
            type="button"
            className="grid h-7 w-7 place-items-center text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-40"
            aria-label="Next financial year"
            disabled={fy >= st.curFy + 2}
            onClick={() => set({ fy: String(fy + 1), period: null, filing: null })}
          >
            <ChevronRight size={15} strokeWidth={1.6} aria-hidden />
          </button>
        </span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-[30px] min-w-0 px-0"
          disabled={!after}
          aria-label={`Export ${fyLabelOf(fy)} filings (CSV)`}
          title="Export"
          onClick={() => {
            download(exportHref);
            toast(`Download started · ${fyLabelOf(fy)} filings (CSV)`);
          }}
        >
          <Download size={16} strokeWidth={1.6} aria-hidden />
        </Button>
        <Button type="button" size="sm" variant="secondary" className="w-[30px] min-w-0 px-0" aria-label="Open the calendar" title="Calendar" onClick={() => go(calHref)}>
          <CalendarDays size={16} strokeWidth={1.6} aria-hidden />
        </Button>
      </span>
    </div>
  );

  const body = !after ? (
    <Empty>Starts after incorporation</Empty>
  ) : q.isError ? (
    <Empty action={<Button size="sm" variant="secondary" onClick={() => void q.refetch()}>Try again</Button>}>Could not load the register</Empty>
  ) : q.isLoading ? (
    <div className="px-4 py-4 md:px-5" aria-busy="true" aria-label="Loading filings">
      <SkeletonRows rows={5} />
    </div>
  ) : !all.length ? (
    <Empty>No filings for {fyLabelOf(fy)}</Empty>
  ) : (
    <div className="px-2 pb-3 pt-1 md:px-3">
      <EFilingGrid
        caption={`Filings · ${winLabel}`}
        columns={columns}
        rows={table}
        rowKey={(r) => r.id}
        onRowClick={open}
        pageSize={12}
        minWidth={760}
        empty={
          <span className="inline-flex flex-wrap items-center justify-center gap-3">
            {status === 'over' ? 'Nothing overdue' : `No ${statusWord ? `${statusWord} ` : ''}filings in ${winLabel}`}
            {status !== 'over' ? (
              <button type="button" className="text-[13px] font-medium text-brand-text hover:underline" onClick={() => openChat(`Why are there no ${statusWord ? `${statusWord} ` : ''}filings in ${winLabel}?`)}>
                Ask VCFO why
              </button>
            ) : null}
          </span>
        }
      />
    </div>
  );

  return (
    <div className="cp-comp-root page stag" ref={root}>
      <Island className="grid gap-4">
        {after && all.length ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
            <DonutCard rows={inView} label="filings" drillTitle={drillTitle} />
            <AreaBars rows={inView} title={`By area · ${winShort}`} drillTitle={drillTitle} openDrill={openDrill} />
          </div>
        ) : null}
        <section ref={tableRef} className="surface min-w-0 overflow-visible">
          {headBar}
          {body}
        </section>
      </Island>
      {detail ? <SidePanel f={detail} onClose={() => set({ filing: null })} /> : null}
    </div>
  );
}

/** Progress by area (R-25, C2): one stacked bar per area in status colours; every row drills down. */
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
  return (
    <div className="min-w-0 rounded-md border-1.5 border-line bg-surface-raised px-4 py-3">
      <h3 className="mb-2.5 text-[13px] font-medium text-ink-muted">{title}</h3>
      <ul className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {AREA_ORDER.map((a) => {
          const rs = rows.filter((r) => r.area === a);
          const filed = rs.filter((r) => r.filedOn).length;
          const L = AREA_LABEL[a];
          const parts = (['ok', 'over', 'due', 'up'] as CompStatus[]).map((s) => ({ s, n: rs.filter((r) => statusOf(r, today) === s).length }));
          return (
            <li key={a}>
              <button
                type="button"
                onClick={() => open(a)}
                aria-label={`${L}: ${filed} of ${rs.length} filed. Show the list`}
                data-tip={`${L} · ${plural(rs.length, 'filing')}`}
                className="-mx-1.5 grid w-[calc(100%+12px)] gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-surface-sunken"
              >
                <span className="flex items-baseline gap-2 text-[13px]">
                  <span className="font-medium text-ink">{L}</span>
                  <span className="ml-auto tabular-nums text-ink-muted">
                    {filed} of {rs.length} filed
                  </span>
                </span>
                <span className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-bar bg-surface-sunken" aria-hidden>
                  {parts
                    .filter((p) => p.n > 0)
                    .map((p) => (
                      <i key={p.s} className={cn('block h-full rounded-[2px]', FILL[p.s])} style={{ width: `${(p.n / Math.max(1, rs.length)) * 100}%` }} />
                    ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
