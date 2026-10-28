'use client';

/**
 * Compliances · one obligation (VCFO Spectrum ObligationScreen): the record head with the
 * status, the area, the next due date and "n of m filed", then This period (the four
 * workflow steps of the open period, ST5), the History grid of every period, and About.
 * A period opens the same side panel as Filings (proof viewer and download, Remind me, Add
 * to my calendar, Ask VCFO). `?filing=<id>` opens that period's panel on load.
 */
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bell, CalendarPlus, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonRows } from '@/components/ui/empty-state';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { usePortal, usePortalCrumbs } from '../../PortalProvider';
import { portalHref } from '../../routes';
import { AREA_FULL, focusNodes, fmtDM, fmtDMY, fyStartOfMonth, portalFor, statusOf, todayIso, type PortalFiling } from '@/lib/client-portal/compliances';
import { fetchProofs, proofHref, useAllFilings, useDownload } from './api';
import { FocusTrack } from './bits';
import { FiledCell, ProofCell } from './cells';
import { CompProvider, useComp } from './ctx';
import { RiskChip, SidePanel } from './Detail';
import { groupObligations, type Obligation } from './obligations';
import { OBLIGATIONS_BASE } from './ObligationsPage';
import { AreaTag, DateTile, Empty, FactRows, GoLink, Island, PortalLink, RecordHead, SCard, StatusChip } from './spectrum';
import '../../css/compliances-board.css';

export function CompliancesObligation({ id }: { id: string }) {
  const today = todayIso();
  const { go } = usePortal();
  const filingsOf = (f: PortalFiling) => `${portalHref('filings')}?fy=${fyStartOfMonth(f.dueDate.slice(0, 7))}&filing=${f.id}`;
  return (
    <div className="cp-compliances">
      <CompProvider
        today={today}
        onDrillRow={(f) => go(filingsOf(f))}
        drillLink={{
          text: 'Open Filings →',
          onClick: () => go(portalHref('filings')),
        }}
      >
        <ObligationBody id={id} today={today} />
      </CompProvider>
    </div>
  );
}

function usePanelParam() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filing = params.get('filing');
  const setFiling = useCallback(
    (v: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (v) next.set('filing', v);
      else next.delete('filing');
      const q = next.toString();
      router.replace(`${pathname}${q ? `?${q}` : ''}`, { scroll: false });
    },
    [params, router, pathname],
  );
  return { filing, setFiling };
}

function ObligationBody({ id, today }: { id: string; today: string }) {
  const { after } = usePortal();
  const q = useAllFilings(after);
  const o = useMemo(() => groupObligations(after ? (q.data?.rows ?? []) : [], today).find((x) => x.id === id) ?? null, [after, q.data, today, id]);
  usePortalCrumbs(['Compliances', 'Obligations', o?.name ?? 'Obligation']);

  const back = (
    <GoLink href={OBLIGATIONS_BASE} className="text-[13px] font-medium text-brand-text hover:underline">
      All obligations
    </GoLink>
  );

  let body: React.ReactNode;
  if (!after)
    body = (
      <SCard title="Obligation">
        <Empty action={back}>Starts after incorporation</Empty>
      </SCard>
    );
  else if (q.isError)
    body = (
      <SCard title="Obligation">
        <Empty
          action={
            <Button size="sm" variant="secondary" onClick={() => void q.refetch()}>
              Try again
            </Button>
          }
        >
          Could not load the register
        </Empty>
      </SCard>
    );
  else if (q.isLoading)
    body = (
      <div aria-busy="true" aria-label="Loading the obligation">
        <SkeletonRows rows={6} />
      </div>
    );
  else if (!o)
    body = (
      <SCard title="Obligation">
        <Empty action={back}>Not on your register</Empty>
      </SCard>
    );
  else
    return (
      <div className="cp-comp-root page">
        <ObligationRecord o={o} today={today} />
      </div>
    );

  return (
    <div className="cp-comp-root page">
      <Island className="grid gap-5">{body}</Island>
    </div>
  );
}

function ObligationRecord({ o, today }: { o: Obligation; today: string }) {
  const { openChat, toast } = usePortal();
  const { companyShort, remind, addToCalendar, openProof } = useComp();
  const download = useDownload();
  const { filing, setFiling } = usePanelParam();
  const panel = filing ? (o.instances.find((r) => r.id === filing) ?? null) : null;
  const cur = o.next ?? o.last;
  const late = o.status === 'over';
  const history = [...o.instances].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const [portal] = portalFor(o);

  const downloadPrimary = (f: PortalFiling) => {
    fetchProofs(f.id)
      .then((p) => {
        if (!p.length) return toast('Proof pending · SBC will upload it');
        download(proofHref(f.id, p[0]!.id));
        toast(`Download started · ${p[0]!.fileName}`);
      })
      .catch(() => toast('Could not download the proof'));
  };

  const actions = o.next ? (
    <>
      <Button
        aria-pressed={Boolean(o.next.reminderOn)}
        onClick={() => (o.next!.reminderOn ? toast(`Reminder already set · email on ${fmtDM(o.next!.reminderOn)}`) : remind(o.next!))}
      >
        <Bell size={16} strokeWidth={1.6} aria-hidden />
        {o.next.reminderOn ? `Reminder ${fmtDM(o.next.reminderOn)}` : 'Remind me'}
      </Button>
      <Button variant="secondary" onClick={() => addToCalendar(o.next!)}>
        <CalendarPlus size={16} strokeWidth={1.6} aria-hidden /> Add to my calendar
      </Button>
    </>
  ) : o.last && o.last.proofCount > 0 ? (
    <Button onClick={() => openProof(o.last!)}>
      <Paperclip size={16} strokeWidth={1.6} aria-hidden /> Open proof
    </Button>
  ) : null;

  const columns: EFilingColumn<PortalFiling>[] = [
    {
      key: 'due',
      header: 'Due',
      width: '64px',
      render: (r) => <DateTile iso={r.dueDate} s={statusOf(r, today)} size="sm" />,
    },
    {
      key: 'period',
      header: 'Period',
      render: (r) => (
        <button
          type="button"
          className="min-w-0 truncate text-left font-medium text-ink"
          aria-label={`${o.name} · ${r.period} · open the details`}
          onClick={(e) => {
            e.stopPropagation();
            setFiling(r.id);
          }}
        >
          {r.period}
        </button>
      ),
    },
    {
      key: 'filed',
      header: 'Filed on',
      width: '120px',
      render: (r) => <FiledCell r={r} today={today} />,
    },
    {
      key: 'ref',
      header: 'Reference',
      width: '190px',
      render: (r) =>
        r.acknowledgementNo ? <span className="font-mono text-[12.5px] text-ink">{r.acknowledgementNo}</span> : <span className="text-ink-faint">-</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '128px',
      render: (r) => <StatusChip s={statusOf(r, today)} />,
    },
    {
      key: 'proof',
      header: 'Proof',
      width: '136px',
      align: 'right',
      render: (r) => <ProofCell r={r} onProof={openProof} onDownload={downloadPrimary} />,
    },
  ];

  return (
    <>
      <Island className="grid gap-5">
        <RecordHead
          title={o.name}
          sub={
            <>
              {o.authorityName} · {o.freqLabel} · {o.companyName}
            </>
          }
          chips={
            <>
              <StatusChip s={o.status} />
              <AreaTag a={o.area} />
            </>
          }
          facts={[
            o.next
              ? {
                  k: 'Next due',
                  v: fmtDMY(o.next.dueDate),
                  tone: late ? 'bad' : undefined,
                }
              : {
                  k: 'Last filed',
                  v: o.last?.filedOn ? fmtDMY(o.last.filedOn) : '-',
                },
            { k: 'Filed', v: `${o.filed} of ${o.total}` },
          ]}
          actions={actions}
        />
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid min-w-0 gap-4">
            {cur ? (
              <SCard
                title="This period"
                meta={cur.period}
                right={
                  <button type="button" className="text-[13px] font-medium text-brand-text hover:underline" onClick={() => setFiling(cur.id)}>
                    Open details
                  </button>
                }
              >
                <FocusTrack nodes={focusNodes(cur, companyShort, today)} />
              </SCard>
            ) : null}
            <SCard title="History" meta={o.instances.length} flush>
              <div className="px-2 pb-3 pt-1 md:px-3">
                <EFilingGrid
                  caption={`${o.name} periods`}
                  columns={columns}
                  rows={history}
                  rowKey={(r) => r.id}
                  onRowClick={(r) => setFiling(r.id)}
                  pageSize={8}
                  minWidth={640}
                  empty="None"
                />
              </div>
            </SCard>
          </div>
          <div className="grid min-w-0 gap-4">
            <SCard title="About" flush>
              <FactRows
                rows={[
                  { k: 'Authority', v: o.authorityName },
                  { k: 'Area', v: AREA_FULL[o.area] },
                  { k: 'Frequency', v: o.freqLabel },
                  { k: 'Penalty risk', v: <RiskChip r={o.penaltyRisk} /> },
                  { k: 'With SBC', v: o.ownerName ?? '-', empty: !o.ownerName },
                  {
                    k: 'Filed on',
                    v: (
                      <span className="inline-flex items-center gap-1">
                        {portal} <PortalLink f={o} />
                      </span>
                    ),
                  },
                ]}
              />
              <div className="border-t border-line-soft px-4 py-3 md:px-5">
                <button type="button" className="text-[13px] font-medium text-brand-text hover:underline" onClick={() => openChat(`Tell me about ${o.name}`)}>
                  Ask VCFO about {o.name}
                </button>
              </div>
            </SCard>
          </div>
        </div>
      </Island>
      {panel ? <SidePanel f={panel} onClose={() => setFiling(null)} /> : null}
    </>
  );
}
