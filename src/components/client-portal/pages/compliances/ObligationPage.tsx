'use client';

/**
 * Compliances · one obligation (VCFO Spectrum ObligationScreen): the record head with the
 * status, the area, the next due date, the step count and "n of m filed", then This period
 * (the four workflow steps of the open period as a vertical ST5 list with their dates), the
 * Past periods grid, About (the text, the facts and the SBC SOP link), and the Why it applies,
 * Due rule and If filed late texts from the scoped obligation read (G-04, asked with one of
 * the client's own filing ids).
 * A period opens the same side panel as Filings (proof viewer and download, Remind me, Add
 * to my calendar, Ask VCFO). `?filing=<id>` opens that period's panel on load.
 */
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bell, CalendarPlus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonRows } from '@/components/ui/empty-state';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { usePortal, usePortalCrumbs } from '../../PortalProvider';
import { portalHref } from '../../routes';
import { AREA_FULL, focusNodes, fmtDM, fyStartOfMonth, portalFor, statusOf, todayIso, type PortalFiling, type TrackNode } from '@/lib/client-portal/compliances';
import { fetchProofs, proofHref, useAllFilings, useDownload } from './api';
import { FiledCell, ProofCell } from './cells';
import { CompProvider, useComp } from './ctx';
import { RiskChip, SidePanel, longPeriod } from './Detail';
import { groupObligations, type Obligation } from './obligations';
import { OBLIGATIONS_BASE } from './ObligationsPage';
import { AreaTag, Empty, FactRows, GoLink, Island, PortalLink, RecordHead, SCard, StatusChip, StepList, type ThreadStep } from './spectrum';
import { useObligationAbout, whyItAppliesLine, type ObligationAbout } from '@/hooks/use-obligation-about';
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
          text: 'Open filings',
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
  const about = useObligationAbout({ instanceId: o.instances[0]?.id ?? null });

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
    <Button onClick={() => downloadPrimary(o.last!)}>
      <Download size={16} strokeWidth={1.6} aria-hidden /> Download acknowledgement
    </Button>
  ) : null;
  const curNodes = cur ? focusNodes(cur, companyShort, today) : [];
  const stepsDone = curNodes.filter((n) => n.st === 'done').length;
  const past = history.filter((r) => r.id !== cur?.id && (r.filedOn || r.dueDate < today));

  const columns: EFilingColumn<PortalFiling>[] = [
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
      width: '124px',
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
                  v: fmtDM(o.next.dueDate),
                  tone: late ? 'bad' : undefined,
                }
              : {
                  k: 'Filed',
                  v: o.last?.filedOn ? fmtDM(o.last.filedOn) : '-',
                },
            ...(curNodes.length ? [{ k: 'Steps', v: `${stepsDone} of ${curNodes.length}` }] : []),
            { k: 'Filed', v: `${o.filed} of ${o.total}` },
          ]}
          actions={actions}
        />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid min-w-0 gap-5">
            {cur ? (
              <SCard
                title="This period"
                meta={cur.periodLong ?? longPeriod(cur.period)}
                right={
                  <button type="button" className="text-[13px] font-medium text-brand-text hover:underline" onClick={() => setFiling(cur.id)}>
                    Open details
                  </button>
                }
              >
                <StepList steps={threadSteps(cur, curNodes, companyShort)} today={today} />
              </SCard>
            ) : null}
            <SCard title="Past periods" flush>
              <div className="px-2 pb-3 pt-1 md:px-3">
                <EFilingGrid
                  caption={`${o.name} past periods`}
                  columns={columns}
                  rows={past}
                  rowKey={(r) => r.id}
                  onRowClick={(r) => setFiling(r.id)}
                  pageSize={6}
                  minWidth={640}
                  empty="None"
                />
              </div>
            </SCard>
          </div>
          <div className="grid min-w-0 gap-5">
            <SCard title="About" flush>
              {about.data?.about ? <p className="px-4 pb-1 pt-4 text-[13.5px] leading-relaxed text-ink-2 md:px-5">{about.data.about}</p> : null}
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
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-soft px-4 py-3 md:px-5">
                <GoLink href={portalHref('knowledge-bank')} className="text-[13px] font-medium text-brand-text hover:underline">
                  Read the SBC SOP
                </GoLink>
                <button type="button" className="text-[13px] font-medium text-brand-text hover:underline" onClick={() => openChat(`Tell me about ${o.name}`)}>
                  Ask VCFO about {o.name}
                </button>
              </div>
            </SCard>
            <AboutTexts about={about.data ?? null} />
          </div>
        </div>
      </Island>
      {panel ? <SidePanel f={panel} onClose={() => setFiling(null)} hideObligation /> : null}
    </>
  );
}

/** The four steps of a period as a vertical ST5 list (prototype SideThread), with the dates the register holds. */
function threadSteps(f: PortalFiling, nodes: TrackNode[], companyShort: string): ThreadStep[] {
  const dates = [f.dataReceivedOn, null, f.approvedOn, f.filedOn];
  return nodes.map((n, i) => {
    const client = n.icon === 'file' || n.icon === 'person';
    const state: ThreadStep['state'] = n.st === 'done' ? 'done' : n.st === 'next' ? 'next' : 'now';
    return {
      key: String(i),
      title: n.label,
      state,
      client,
      holder: client ? `With ${companyShort}` : 'With SBC',
      note: state === 'done' ? (i === 3 && f.filedByName ? `${f.filedByName} · SBC` : undefined) : n.sub || undefined,
      date: dates[i] ?? undefined,
    };
  });
}

/** Why it applies and Due rule, then If filed late; not drawn until loaded. The about text sits in the About card. */
function AboutTexts({ about }: { about: ObligationAbout | null }) {
  if (!about) return null;
  const why = whyItAppliesLine(about);
  return (
    <>
      {why ? (
        <SCard title="Why it applies">
          <p className="text-[13.5px] leading-relaxed text-ink-2">{why}</p>
        </SCard>
      ) : null}
      {about.dueRule ? (
        <SCard title="Due rule">
          <p className="text-[13.5px] leading-relaxed text-ink-2">{about.dueRule}</p>
        </SCard>
      ) : null}
      {about.ifLate ? (
        <SCard title="If filed late">
          <p className="text-[13.5px] leading-relaxed text-ink-2">{about.ifLate}</p>
        </SCard>
      ) : null}
    </>
  );
}
