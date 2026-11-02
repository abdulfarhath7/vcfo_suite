'use client';

import { useEffect, useState } from 'react';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { FilterChip } from '@/components/ui/filter-chip';
import { Button } from '@/components/ui/button';
import { DevCard, LoadOlder, Pending, StatusChip } from '@/components/dev/parts';
import { useDevApi } from '@/components/dev/use-dev-api';
import { stamp } from '@/lib/dev/format';
import { actionLabel } from '@/lib/dev/audit-actions';
import { ROLE_UI_LABEL, type Role } from '@/lib/auth';
import type { AuditPayload, AuditRow } from '@/lib/dev/types';

/**
 * Audit: system and access events (sign-in, sessions, two-step, accounts, settings, jobs,
 * lockouts) and any failed or denied action, newest first, with "Load older". Client actors
 * show as "Client" and summaries arrive scrubbed.
 */

const RESULTS = ['all', 'ok', 'failed', 'denied'] as const;
const DAYS = [
  { value: '1', label: 'Today' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
];

export default function DevAudit() {
  const [result, setResult] = useState<(typeof RESULTS)[number]>('all');
  const [days, setDays] = useState('');
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const base = new URLSearchParams();
  if (result !== 'all') base.set('result', result);
  if (days) base.set('days', days);
  const url = `/api/dev/audit${base.size ? `?${base.toString()}` : ''}`;
  const q = useDevApi<AuditPayload>(url);

  const [extra, setExtra] = useState<AuditRow[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setExtra([]);
    setCursor(undefined);
  }, [url]);
  const next = cursor === undefined ? q.data?.nextBefore : cursor;

  const loadOlder = async () => {
    if (!next) return;
    setBusy(true);
    try {
      const sp = new URLSearchParams(base);
      sp.set('before', next);
      const res = await fetch(`/api/dev/audit?${sp.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const page = (await res.json()) as AuditPayload;
      setExtra((x) => [...x, ...page.events]);
      setCursor(page.nextBefore);
    } finally {
      setBusy(false);
    }
  };

  const loaded = [...(q.data?.events ?? []), ...extra];
  // Actor and action filter the rows already loaded; result and date run on the server.
  const actors = [...new Set(loaded.map((a) => a.actor))].sort();
  const actions = [...new Set(loaded.map((a) => a.action))].sort();
  const rows = loaded.filter((a) => (!actor || a.actor === actor) && (!action || a.action === action));
  const any = result !== 'all' || !!days || !!actor || !!action;
  const val = (v: string | null | undefined) => (v ? <span className="font-mono text-[12px] text-ink-2">{v}</span> : <span className="text-ink-faint">-</span>);

  const columns: EFilingColumn<AuditRow>[] = [
    { key: 'at', header: 'Time', width: '140px', render: (a) => stamp(a.createdAt) },
    {
      key: 'actor',
      header: 'Actor',
      width: '18%',
      render: (a) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-ink">{a.actor}</span>
          <span className="block truncate text-[12px] text-ink-muted">{ROLE_UI_LABEL[a.role as Role] ?? a.role}</span>
        </span>
      ),
    },
    { key: 'action', header: 'Action', width: '20%', render: (a) => <span title={a.action}>{actionLabel(a.action)}</span> },
    { key: 'summary', header: 'Change', wrap: true, render: (a) => <span className="block py-2 text-[13px]">{a.summary}</span> },
    { key: 'before', header: 'Before', width: '130px', wrap: true, render: (a) => val(a.before) },
    { key: 'after', header: 'After', width: '130px', wrap: true, render: (a) => val(a.after) },
    { key: 'result', header: 'Result', width: '148px', render: (a) => <StatusChip status={a.result} /> },
  ];

  return (
    <DevCard
      title="Audit log"
      meta="System and access · newest first"
      filters={
        <>
          <SpectrumTabs
            label="Result"
            items={RESULTS.map((r) => ({ key: r, label: r === 'all' ? 'All' : r === 'ok' ? 'OK' : r.charAt(0).toUpperCase() + r.slice(1) }))}
            value={result}
            onChange={(k) => setResult(k as typeof result)}
          />
          <FilterChip label="Actor" value={actor} onChange={setActor} options={actors.map((x) => ({ value: x, label: x }))} />
          <FilterChip label="Action" value={action} onChange={setAction} options={actions.map((x) => ({ value: x, label: actionLabel(x) }))} />
          <FilterChip label="Date" value={days} onChange={setDays} options={DAYS} />
          {any ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setResult('all');
                setDays('');
                setActor('');
                setAction('');
              }}
            >
              Clear all
            </Button>
          ) : null}
        </>
      }
    >
      {q.data ? (
        <>
          <div className="px-2 pb-2">
            <EFilingGrid columns={columns} rows={rows} rowKey={(a) => a.id} pageSize={50} minWidth={1100} empty="No entries match" stickyFirstColumn />
          </div>
          {next ? <LoadOlder onClick={() => void loadOlder()} busy={busy} /> : null}
        </>
      ) : (
        <Pending error={q.error} />
      )}
    </DevCard>
  );
}
