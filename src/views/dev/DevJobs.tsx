'use client';

import { useMemo, useState } from 'react';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Button } from '@/components/ui/button';
import { DevCard, ListRow, Pending, ReachChip, ReachNotice, StatusChip, useDevAction } from '@/components/dev/parts';
import { useDevApi } from '@/components/dev/use-dev-api';
import { duration, stamp } from '@/lib/dev/format';
import { canRetryRun, cronWords, nextCronRun } from '@/lib/dev/parse';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import type { JobFunction, JobRun, JobsPayload } from '@/lib/dev/types';

type FnRow = JobFunction & { last: JobRun | null; failures: number };

/**
 * Jobs: the Inngest functions registered in `src/jobs/` and their runs in the last 7 days
 * from the Inngest REST API. Without INNGEST_SIGNING_KEY the runs card says "not set up";
 * the function list still shows, because it comes from the code.
 */
export default function DevJobs() {
  const q = useDevApi<JobsPayload>('/api/dev/jobs', { refetchMs: 60_000 });
  const [tab, setTab] = useState('all');
  const retry = useDevAction<{ runId: string; eventId: string }>('/api/dev/jobs/retry');
  // Runs queued again in this visit, so their button reads "Queued again" until the list refreshes.
  const [queued, setQueued] = useState<Set<string>>(() => new Set());

  /* R-40: a retry sends the event that started the run once more. The route checks the run
     again, writes the audit row and refuses a cron run or a shared event. */
  const doRetry = async (r: JobRun) => {
    if (!r.eventId) return;
    const out = await retry.run({ runId: r.id, eventId: r.eventId });
    if (out.ok === false) {
      toastError('Retry refused', out.error);
      return;
    }
    setQueued((prev) => new Set(prev).add(r.id));
    toastSuccess('Queued again', r.functionId ?? r.event);
  };

  const runs = useMemo(() => (q.data?.runs.state === 'ok' ? q.data.runs.data : []), [q.data]);
  const fns: FnRow[] = useMemo(
    () =>
      (q.data?.functions ?? []).map((f) => {
        const mine = runs.filter((r) => r.functionId === f.id);
        return { ...f, last: mine[0] ?? null, failures: mine.filter((r) => r.status === 'Failed').length };
      }),
    [q.data, runs],
  );

  const counts = {
    failed: runs.filter((r) => r.status === 'Failed').length,
    running: runs.filter((r) => r.status === 'Running').length,
  };
  const shown = runs.filter((r) => (tab === 'failed' ? r.status === 'Failed' : tab === 'running' ? r.status === 'Running' : true));
  const live = q.data?.runs.state === 'ok';
  const fnList = q.data?.functions ?? [];
  const failures = runs.filter((r) => r.status === 'Failed').slice(0, 8);

  const retryCell = (r: JobRun) => {
    if (r.status !== 'Failed') return null;
    if (queued.has(r.id)) return <span className="text-[13px] text-ink-muted">Queued again</span>;
    if (!canRetryRun(r, fnList)) return <span className="text-[12.5px] text-ink-faint">Waits for next run</span>;
    return (
      <Button size="sm" variant="secondary" disabled={retry.busy} onClick={() => void doRetry(r)}>
        Retry
      </Button>
    );
  };

  const fnColumns: EFilingColumn<FnRow>[] = [
    { key: 'id', header: 'Job', width: '24%', render: (f) => <span className="font-mono text-[13px] font-medium text-ink">{f.id}</span> },
    {
      key: 'trigger',
      header: 'Runs on',
      width: '28%',
      render: (f) =>
        f.trigger.kind === 'cron' ? (
          <span className="block min-w-0">
            <span className="block truncate">{cronWords(f.trigger.cron)}</span>
            <span className="block truncate font-mono text-[12px] text-ink-muted">{f.trigger.cron}</span>
          </span>
        ) : (
          <span className="block min-w-0">
            <span className="block truncate">Event</span>
            <span className="block truncate font-mono text-[12px] text-ink-muted">{f.trigger.event}</span>
          </span>
        ),
    },
    { key: 'retries', header: 'Retries', width: '80px', align: 'right', render: (f) => (f.retries ?? '-') },
    { key: 'last', header: 'Last run', width: '140px', render: (f) => (live ? stamp(f.last?.startedAt) : '-') },
    { key: 'dur', header: 'Duration', width: '110px', render: (f) => (live && f.last ? duration(f.last.startedAt, f.last.endedAt) : '-') },
    { key: 'status', header: 'Status', width: '148px', render: (f) => (live && f.last ? <StatusChip status={f.last.status} /> : <span className="text-ink-faint">-</span>) },
    {
      key: 'fails',
      header: 'Failures, 7 days',
      width: '120px',
      align: 'right',
      render: (f) => (live ? <span className={f.failures > 0 ? 'font-medium text-danger' : 'text-ink-muted'}>{f.failures}</span> : '-'),
    },
    {
      key: 'next',
      header: 'Next run',
      width: '140px',
      render: (f) => (f.trigger.kind === 'cron' ? stamp(nextCronRun(f.trigger.cron)) : <span className="text-ink-faint">On event</span>),
    },
  ];

  const runColumns: EFilingColumn<JobRun>[] = [
    { key: 'at', header: 'Started', width: '150px', render: (r) => stamp(r.startedAt) },
    { key: 'fn', header: 'Job', render: (r) => <span className="font-mono text-[13px]">{r.functionId ?? '-'}</span> },
    { key: 'event', header: 'Event', width: '26%', render: (r) => <span className="font-mono text-[12.5px] text-ink-muted">{r.event}</span> },
    { key: 'dur', header: 'Duration', width: '110px', render: (r) => duration(r.startedAt, r.endedAt) },
    { key: 'status', header: 'Status', width: '148px', render: (r) => <StatusChip status={r.status} /> },
    { key: 'act', header: '', width: '150px', align: 'right', render: retryCell },
  ];

  return (
    <div className="grid grid-cols-1 gap-5">
      <DevCard title="Scheduled jobs" meta="Inngest · from src/jobs">
        {q.data ? (
          <div className="px-2 pb-2">
            <EFilingGrid columns={fnColumns} rows={fns} rowKey={(f) => f.id} minWidth={1000} stickyFirstColumn stickyHead />
          </div>
        ) : (
          <Pending error={q.error} />
        )}
      </DevCard>

      {live && failures.length ? (
        <DevCard title="Recent failures" meta={`${counts.failed} in 7 days`}>
          {failures.map((r) => (
            <ListRow key={r.id}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[13px] font-medium text-ink">
                  {r.functionId ?? r.event} · {stamp(r.startedAt)}
                </span>
                <span className="block truncate text-[12.5px] text-ink-muted">{r.event}</span>
              </span>
              <StatusChip status={r.status} />
              <span className="flex w-[150px] flex-none justify-end">{retryCell(r)}</span>
            </ListRow>
          ))}
        </DevCard>
      ) : null}

      <DevCard
        title="Recent runs"
        meta="Last 7 days"
        right={q.data ? <ReachChip reach={q.data.runs} /> : null}
        filters={
          live ? (
            <SpectrumTabs
              label="Show"
              items={[
                { key: 'all', label: 'All', count: runs.length },
                { key: 'failed', label: 'Failed', count: counts.failed },
                { key: 'running', label: 'Running', count: counts.running },
              ]}
              value={tab}
              onChange={setTab}
            />
          ) : null
        }
      >
        {!q.data ? (
          <Pending error={q.error} />
        ) : q.data.runs.state === 'ok' ? (
          <div className="px-2 pb-2">
            <EFilingGrid columns={runColumns} rows={shown} rowKey={(r) => r.id} pageSize={20} minWidth={900} empty="No runs match" stickyFirstColumn />
          </div>
        ) : (
          <ReachNotice reach={q.data.runs} service="Inngest" />
        )}
      </DevCard>
    </div>
  );
}
