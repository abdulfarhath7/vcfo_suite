'use client';

/**
 * Compliances · Obligations (VCFO Spectrum ObligationsScreen, owner decision D-06): the
 * client's register grouped by filing. Each row is one obligation: a date tile (the next due
 * date, or the last filed date), the name, the area pill, "n of m filed" for the current FY
 * and the status. The right rail keeps three cards: Due in the next 15 days, Waiting on
 * client, Progress flow. Data: GET /api/client/compliances (every year, client-compliances
 * repository), the same rows the Calendar and Filings pages read.
 */
import { useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip as SChip } from '@/components/ui/spectrum-chip';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { SkeletonRows } from '@/components/ui/empty-state';
import { usePortal } from '../../PortalProvider';
import { portalHref } from '../../routes';
import {
  AREA_LABEL,
  AREA_ORDER,
  fyLabelOf,
  fyStartOfMonth,
  todayIso,
  type CompStatus,
  type PortalFiling,
} from '@/lib/client-portal/compliances';
import { useAllFilings } from './api';
import { usePageTips } from './bits';
import { CompProvider } from './ctx';
import { FREQ_ORDER, dueWithin, freqKey, groupObligations, waitingOnClient, type Obligation } from './obligations';
import {
  AreaTag,
  DateTile,
  Empty,
  FILL,
  GoLink,
  GroupHead,
  HeadSearch,
  Island,
  ListRow,
  SCard,
  STATUS_ORDER,
  StackedBar,
  StatusChip,
  WORD,
  relativeDue,
} from './spectrum';
import '../../css/compliances-board.css';

export const OBLIGATIONS_BASE = portalHref('obligations');

/** The record page of one obligation; `filing` opens that period's side panel. */
export function obligationHref(id: string, filing?: string): string {
  return `${OBLIGATIONS_BASE}/${encodeURIComponent(id)}${filing ? `?filing=${encodeURIComponent(filing)}` : ''}`;
}

const FREQ_LABEL: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  'half-yearly': 'Half-yearly',
  annual: 'Annual',
  'one-time': 'One-time',
  other: 'Other',
};

export function CompliancesObligations() {
  const today = todayIso();
  const { go } = usePortal();
  const filingsOf = (f: PortalFiling) => `${portalHref('filings')}?fy=${fyStartOfMonth(f.dueDate.slice(0, 7))}&filing=${f.id}`;
  return (
    <div className="cp-compliances">
      <CompProvider today={today} onDrillRow={(f) => go(filingsOf(f))} drillLink={{ text: 'Open Filings →', onClick: () => go(portalHref('filings')) }}>
        <ObligationsBody today={today} />
      </CompProvider>
    </div>
  );
}

function ObligationsBody({ today }: { today: string }) {
  const { after, shell, go } = usePortal();
  const root = useRef<HTMLDivElement>(null);
  usePageTips(root);
  const q = useAllFilings(after);
  const obligations = useMemo(() => groupObligations(after ? q.data?.rows ?? [] : [], today), [after, q.data, today]);
  const [view, setView] = useState<'freq' | 'area'>('freq');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CompStatus | null>(null);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const companyShort = shell?.companyShort || 'Your company';

  const needle = search.trim().toLowerCase();
  const shown = obligations.filter(
    (o) => (!status || o.status === status) && (!needle || `${o.name} ${AREA_LABEL[o.area]} ${o.authorityName}`.toLowerCase().includes(needle)),
  );
  const sections =
    view === 'freq'
      ? [...FREQ_ORDER, 'other'].map((k) => ({ id: k, label: FREQ_LABEL[k]!, rows: shown.filter((o) => freqKey(o) === k) }))
      : AREA_ORDER.map((a) => ({ id: a, label: AREA_LABEL[a], rows: shown.filter((o) => o.area === a) }));
  const groups = sections.filter((s) => s.rows.length);
  const fy = fyLabelOf(fyStartOfMonth(today.slice(0, 7)));

  const due = dueWithin(obligations, today, 15);
  const waiting = waitingOnClient(obligations, today, companyShort);
  const count = (s: CompStatus) => obligations.filter((o) => o.status === s).length;

  const head = (
    <span className="flex flex-wrap items-center gap-2">
      <HeadSearch value={search} onChange={setSearch} label="Search obligations" onEnter={() => shown[0] && go(obligationHref(shown[0].id))} />
      <SpectrumTabs
        label="Group obligations"
        size="md"
        value={view}
        onChange={(k) => setView(k as 'freq' | 'area')}
        items={[
          { key: 'freq', label: 'By frequency' },
          { key: 'area', label: 'By area' },
        ]}
      />
    </span>
  );

  const list = !after ? (
    <Empty>Starts after incorporation</Empty>
  ) : q.isError ? (
    <Empty action={<Button size="sm" variant="secondary" onClick={() => void q.refetch()}>Try again</Button>}>Could not load the register</Empty>
  ) : q.isLoading ? (
    <div className="px-4 py-4 md:px-5" aria-busy="true" aria-label="Loading obligations">
      <SkeletonRows rows={5} />
    </div>
  ) : !obligations.length ? (
    <Empty>No obligations on the register yet</Empty>
  ) : !groups.length ? (
    <Empty
      action={
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setSearch('');
            setStatus(null);
          }}
        >
          Clear
        </Button>
      }
    >
      None
    </Empty>
  ) : (
    <div>
      {status ? (
        <div className="flex items-center gap-2 border-b border-line-soft px-4 py-2 md:px-5">
          <span className="inline-flex h-[30px] items-center gap-1.5 rounded-md border-1.5 border-brand-line bg-brand-soft pl-2.5 pr-1 text-[13px] font-medium text-brand-text">
            {WORD[status]}
            <button type="button" className="grid h-5 w-5 place-items-center rounded-sm hover:bg-surface-raised" aria-label="Clear the status filter" onClick={() => setStatus(null)}>
              ×
            </button>
          </span>
        </div>
      ) : null}
      {groups.map((g) => {
        const open = needle || status ? true : !closed[g.id];
        return (
          <div key={g.id}>
            <GroupHead label={g.label} count={g.rows.length} open={Boolean(open)} onToggle={() => setClosed((c) => ({ ...c, [g.id]: !c[g.id] }))} />
            {open ? (
              <ul>
                {g.rows.map((o) => (
                  <li key={o.id}>
                    <ObligationRow o={o} fy={fy} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="cp-comp-root page" ref={root}>
      <Island className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <SCard title="Obligations" meta={after && obligations.length ? shown.length : undefined} right={head} flush>
          {list}
        </SCard>
        <div className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-1">
          <SCard title="Due in the next 15 days" meta={after ? due.length : undefined} flush>
            {!after ? (
              <Empty>After the certificate</Empty>
            ) : q.isLoading ? (
              <div className="p-4">
                <SkeletonRows rows={2} />
              </div>
            ) : due.length ? (
              due.slice(0, 8).map(({ o, f }) => <DueRow key={f.id} o={o} f={f} today={today} />)
            ) : (
              <Empty />
            )}
          </SCard>
          <SCard title="Waiting on client" meta={after ? waiting.length : undefined} flush>
            {waiting.length ? (
              waiting.slice(0, 8).map(({ o, f, step }) => (
                <ListRow key={f.id}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{o.name}</span>
                    <span className="block truncate text-[12.5px] text-ink-muted">
                      {step} · {f.period}
                    </span>
                  </span>
                  <Button size="sm" onClick={() => go(obligationHref(o.id, f.id))}>
                    Open
                  </Button>
                </ListRow>
              ))
            ) : (
              <Empty />
            )}
          </SCard>
          <SCard title="Progress flow" className="md:col-span-2 lg:col-span-1">
            <StackedBar
              onPick={(k) => setStatus((cur) => (cur === k ? null : (k as CompStatus)))}
              segments={STATUS_ORDER.map((s) => ({ key: s, label: WORD[s], value: after ? count(s) : 0, fill: FILL[s] }))}
            />
          </SCard>
        </div>
      </Island>
    </div>
  );
}

function ObligationRow({ o, fy }: { o: Obligation; fy: string }) {
  return (
    <GoLink
      href={obligationHref(o.id)}
      label={`${o.name} · ${WORD[o.status]} · ${o.filed} of ${o.total} filed`}
      className="flex min-w-0 items-center gap-3 border-t border-line-soft px-4 py-2.5 text-[14px] text-ink hover:bg-surface-sunken md:px-5"
    >
      <DateTile iso={o.tileDate} s={o.status} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">{o.name}</span>
        <span className="block truncate text-[12.5px] text-ink-muted">
          {o.authorityName} · {o.freqLabel}
        </span>
      </span>
      <AreaTag a={o.area} className="hidden sm:inline-flex" />
      <span className="hidden w-[96px] flex-none text-right text-[13px] tabular-nums text-ink-muted md:inline" title={fy}>
        {o.filed} of {o.total} filed
      </span>
      <StatusChip s={o.status} />
      <ChevronRight size={16} strokeWidth={1.6} className="flex-none text-ink-faint" aria-hidden />
    </GoLink>
  );
}

function DueRow({ o, f, today }: { o: Obligation; f: PortalFiling; today: string }) {
  const rel = relativeDue(today, f.dueDate);
  const late = rel.tone === 'bad';
  return (
    <GoLink
      href={obligationHref(o.id, f.id)}
      label={`${o.name} · ${f.period} · ${rel.label}`}
      className={`flex min-w-0 items-center gap-3 border-t border-line-soft px-4 py-2.5 text-[14px] text-ink first:border-t-0 hover:bg-surface-sunken md:px-5${late ? ' bg-danger-soft' : ''}`}
    >
      <DateTile iso={f.dueDate} s={late ? 'over' : rel.tone === 'warn' ? 'due' : 'none'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium">
          {o.name} · {f.period}
        </span>
        <span className="block truncate text-[12.5px] text-ink-muted">{AREA_LABEL[o.area]}</span>
      </span>
      <SChip tone={rel.tone} fixed>
        {rel.label}
      </SChip>
    </GoLink>
  );
}
