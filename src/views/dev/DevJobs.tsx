'use client';

import { useMemo, useState } from 'react';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Button } from '@/components/ui/button';
import { CloseButton, DevCard, KeyValue, ListRow, Pending, ReachChip, ReachNotice, StatusChip, SwitchRow, pickedRow, useDevAction } from '@/components/dev/parts';
import { EmptyState } from '@/components/ui/empty-state';
import { useDevApi } from '@/components/dev/use-dev-api';
import { duration, stamp, stampSec } from '@/lib/dev/format';
import { cn } from '@/lib/utils';
import { canRetryRun, cronWords, nextCronRun } from '@/lib/dev/parse';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import type { JobFunction, JobRun, JobRunDetail, JobsPayload, LogLine } from '@/lib/dev/types';

const LEVEL_TEXT: Record<LogLine['level'], string> = { error: 'text-danger', warn: 'text-warning', info: 'text-ink-muted' };

/** "Run log" for the picked run: what Inngest says, then the app log lines naming the job. */
function RunLog({ run, onClose }: { run: JobRun; onClose: () => void }) {
  const sp = new URLSearchParams({ runId: run.id });
  if (run.functionId) sp.set('functionId', run.functionId);
  if (run.startedAt) sp.set('start', run.startedAt);
  const q = useDevApi<JobRunDetail>(`/api/dev/jobs/run-detail?${sp.toString()}`);
  const r = q.data?.run;
  return (
    <DevCard title="Run log" meta={`${run.functionId ?? run.event} · ${stamp(run.startedAt)}`} right={<CloseButton onClick={onClose} />}>
      {!q.data ? (
        <Pending error={q.error} rows={4} />
      ) : (
        <>
          {r?.state === 'ok' ? (
            <KeyValue
              cols={4}
              rows={[
                { k: 'Status', v: <StatusChip status={r.data.status} /> },
                { k: 'Started', v: stamp(r.data.startedAt) },
                { k: 'Duration', v: duration(r.data.startedAt, r.data.endedAt) },
                { k: 'Run ID', v: r.data.id, mono: true },
              ]}
            />
          ) : r ? (
            <ReachNotice reach={r} service="Inngest" />
          ) : null}
          {r?.state === 'ok' && r.data.output ? (
            <pre className="mx-4 mb-3 max-h-[160px] overflow-auto whitespace-pre-wrap break-words rounded-md border-1.5 border-line bg-surface-sunken p-3 font-mono text-[12.5px] text-ink-2">{r.data.output}</pre>
          ) : null}
          {q.data.lines.state === 'ok' ? (
            q.data.lines.data.length ? (
              <ol className="mx-4 mb-4 max-h-[320px] overflow-auto rounded-md border-1.5 border-line bg-surface-sunken p-3 font-mono text-[12.5px]">
                {q.data.lines.data.map((l) => (
                  <li key={l.id} className="flex gap-3 py-0.5">
                    <span className="flex-none text-ink-faint">{stampSec(l.at).split(', ')[1]}</span>
                    <span className={cn('w-12 flex-none uppercase', LEVEL_TEXT[l.level])}>{l.level}</span>
                    <span className="min-w-0 break-words text-ink-2">{l.message}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="px-4 pb-4">
                <EmptyState title="No log lines name this job" />
              </div>
            )
          ) : (
            <ReachNotice reach={q.data.lines} service="CloudWatch Logs" />
          )}
        </>
      )}
    </DevCard>
  );
}

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
  const [picked, setPicked] = useState<string | null>(null);
  const runNow = useDevAction<{ functionId: string }>('/api/dev/jobs/run');
  const pause = useDevAction<{ on: boolean }>('/api/dev/jobs/pause');
  const paused = q.data?.paused.on ?? false;

  const doRunNow = async (f: JobFunction) => {
    const out = await runNow.run({ functionId: f.id });
    if (out.ok === false) {
      toastError('Run refused', out.error);
      return;
    }
    toastSuccess('Started', f.id);
  };

  const doPause = async (on: boolean) => {
    const out = await pause.run({ on });
    if (out.ok === false) {
      toastError('Not changed', out.error);
      return;
    }
    toastSuccess(on ? 'Jobs paused' : 'Jobs resumed');
  };

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
  const curRun = runs.find((r) => r.id === picked) ?? null;
  const lastRun = runs[0] ?? null;

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
    {
      key: 'run',
      header: '',
      width: '110px',
      align: 'right',
      render: (f) => (
        <Button
          size="sm"
          variant="secondary"
          title={f.runEvent ? undefined : 'This job has no dev/run event yet'}
          disabled={!f.runEvent || paused || runNow.busy || f.last?.status === 'Running'}
          onClick={(e) => {
            e.stopPropagation();
            void doRunNow(f);
          }}
        >
          Run now
        </Button>
      ),
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
      <DevCard title="Scheduled jobs" meta={paused ? 'Paused' : 'Inngest · times in IST'}>
        {q.data ? (
          <div className="px-2 pb-2">
            <EFilingGrid
              columns={fnColumns}
              rows={fns}
              rowKey={(f) => f.id}
              minWidth={1110}
              stickyFirstColumn
              stickyHead
              onRowClick={(f) => (f.last ? setPicked((p) => (p === f.last!.id ? null : f.last!.id)) : undefined)}
              rowClassName={pickedRow((f: FnRow) => f.last?.id ?? '', picked)}
            />
          </div>
        ) : (
          <Pending error={q.error} />
        )}
      </DevCard>

      {curRun ? <RunLog key={curRun.id} run={curRun} onClose={() => setPicked(null)} /> : null}

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
            <EFilingGrid
              columns={runColumns}
              rows={shown}
              rowKey={(r) => r.id}
              pageSize={20}
              minWidth={900}
              empty="No runs match"
              stickyFirstColumn
              onRowClick={(r) => setPicked((p) => (p === r.id ? null : r.id))}
              rowClassName={pickedRow((r: JobRun) => r.id, picked)}
            />
          </div>
        ) : (
          <ReachNotice reach={q.data.runs} service="Inngest" />
        )}
      </DevCard>
      <DevCard title="Queue">
        {q.data ? (
          <>
            <KeyValue
              rows={[
                { k: 'Jobs', v: fnList.length },
                {
                  k: 'Running now',
                  v: live ? (counts.running ? `${counts.running} · ${[...new Set(runs.filter((r) => r.status === 'Running').map((r) => r.functionId ?? r.event))].join(', ')}` : '0') : '-',
                },
                { k: 'Failed, 7 days', v: live ? counts.failed : '-' },
                { k: 'Runs, 7 days', v: live ? runs.length : '-' },
                { k: 'Last run', v: live && lastRun ? `${lastRun.functionId ?? lastRun.event} · ${stamp(lastRun.startedAt)}` : '-' },
                { k: 'Paused by', v: paused ? `${q.data.paused.by ?? 'Someone'} · ${stamp(q.data.paused.at)}` : '-' },
              ]}
            />
            <div className="border-t border-line-soft">
              <SwitchRow
                label="Pause all jobs"
                on={paused}
                busy={pause.busy}
                confirmOn={{ question: 'Pause all jobs? No reminder goes out until you resume.', confirm: 'Pause' }}
                onChange={doPause}
              />
            </div>
          </>
        ) : (
          <Pending error={q.error} rows={3} />
        )}
      </DevCard>
    </div>
  );
}
