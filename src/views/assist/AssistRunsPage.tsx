'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bot, Coins, Hand, Settings, Wand2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { DashHero } from '@/components/dash/DashHero';
import { DashSection } from '@/components/dash/DashSection';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { EmptyState, SkeletonRows } from '@/components/ui/empty-state';
import { FilterSelect } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { ProgressBar } from '@/components/common/ProgressBar';
import { Chip, Tag, type ChipTone } from '@/components/ui/spectrum-chip';
import { useAssistAgentRuns, useAssistPatches, useReviewAssistPatch } from '@/hooks/use-assist-agents';
import { useAgentRunsList } from '@/hooks/use-agent-runs';
import { isAdminOrManager, isFirmWideAdmin } from '@/lib/auth';
import { roleAppSegment } from '@/lib/auth-routes';
import type { AssistAgentRunView, AssistPatchStatus, AssistPatchView } from '@/lib/assist-agents/types';
import {
  AGENT_RUN_BUCKET_LABEL,
  AGENT_RUN_BUCKETS,
  type AgentRunFilters,
  type AgentRunItem,
  type AgentRunPeriod,
  type AgentRunStateFilter,
} from '@/lib/card-agents/overview';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { runAwaitsAttestation } from '@/lib/assist-agents/attestation';
import { AgentMark, AgentStateChip, ROUTE_LABEL, fieldsPercent } from '@/views/agents/agent-run-parts';
import { AgentRunDetail } from '@/views/agents/AgentRunDetail';
import { AssistRunDetail } from './AssistRunDetail';

/**
 * AGENT RUNS — the control room (docs/specs/live-portal-browser/MASTER-PLAN.md screen 9), one page
 * for every staff role (it grew out of the Assist runs page, docs/specs/vcfo-assist-agents/PLAN.md).
 * It lists every card agent run in the viewer's scope across both routes: live browser sessions and
 * VCFO Assist extension runs (browser) and GST returns filed through the GSP (API), with filters for
 * state, period and agent and a search. The repository decides what each role sees: a project lead
 * sees only the engagements they lead.
 *
 * A row opens the run: an extension run opens its evidence log and the certifier's checks
 * (`AssistRunDetail`, SAFETY.md G14 and G17) as before; a live session or a GST return opens
 * `AgentRunDetail` (fields, refusals, heals, who did each "your turn", viewers and IPs).
 * `?run=<assist run id>` (the side panel's "Open in Suite") opens that run straight away, and
 * `?state=` and `?period=` set the first filters. The recipe patch review queue stays below; only
 * admins and managers get Approve and Reject.
 */

const PATCH_LOOK: Record<AssistPatchStatus, { label: string; tone: ChipTone }> = {
  proposed: { label: 'Waiting', tone: 'teal' },
  approved: { label: 'Approved', tone: 'ok' },
  rejected: { label: 'Rejected', tone: 'bad' },
};

const PATCH_VIEWS = [
  { value: 'proposed', label: 'To review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const number = (n: number) => n.toLocaleString('en-IN');
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const TH = 'whitespace-nowrap px-3 py-2 font-medium';
const TD = 'whitespace-nowrap px-3 py-2.5 text-ink-2';

const STATE_OPTIONS: Array<{ value: AgentRunStateFilter; label: string }> = [
  { value: 'all', label: 'All states' },
  { value: 'open', label: 'Open' },
  ...AGENT_RUN_BUCKETS.map((b) => ({ value: b, label: AGENT_RUN_BUCKET_LABEL[b] })),
];

const PERIOD_OPTIONS: Array<{ value: AgentRunPeriod; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

/** The first state and period from the address (`?state=your_turn&period=today`). */
function filtersFromUrl(): Pick<AgentRunFilters, 'state' | 'period'> {
  const q = new URLSearchParams(window.location.search);
  const state = STATE_OPTIONS.find((o) => o.value === q.get('state'))?.value ?? 'all';
  const period = PERIOD_OPTIONS.find((o) => o.value === q.get('period'))?.value ?? 'week';
  return { state, period };
}

function CertifierCell({ assist, onOpen }: { assist: AssistAgentRunView | undefined; onOpen: () => void }) {
  if (!assist) return <>—</>;
  if (assist.attestation) {
    return (
      <Chip raw tone="ok">
        Checked
      </Chip>
    );
  }
  if (runAwaitsAttestation(assist)) {
    return (
      <Button size="sm" variant="soft" onClick={onOpen}>
        Record checks
      </Button>
    );
  }
  if (assist.srn) {
    return (
      <Chip raw tone="bad">
        None
      </Chip>
    );
  }
  return <>—</>;
}

function RunsTable({ runs, assistById, onOpen }: { runs: AgentRunItem[]; assistById: Map<string, AssistAgentRunView>; onOpen: (run: AgentRunItem) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-[13px]">
        <thead className="text-[12px] text-ink-muted">
          <tr>
            <th scope="col" className={`${TH} pl-4`}>
              Agent
            </th>
            <th scope="col" className={TH}>
              Client
            </th>
            <th scope="col" className={TH}>
              Route
            </th>
            <th scope="col" className={TH}>
              State
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Time
            </th>
            <th scope="col" className={TH}>
              Result
            </th>
            <th scope="col" className={TH}>
              Certifier
            </th>
            <th scope="col" className={`${TH} pr-4 text-right`}>
              <span className="sr-only">Card</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const assist = run.assistRunId ? assistById.get(run.assistRunId) : undefined;
            const pct = run.bucket === 'running' ? fieldsPercent(run) : null;
            return (
              <tr key={run.id} className="border-t border-line-soft">
                <th scope="row" className="whitespace-nowrap px-4 py-2.5 font-medium text-ink">
                  <span className="flex items-center gap-2.5">
                    <AgentMark taskId={run.taskId} />
                    <span className="min-w-0">
                      <button type="button" className="block text-left text-brand-text hover:underline" onClick={() => onOpen(run)}>
                        {run.agentName}
                      </button>
                      <span className="block text-[11.5px] font-normal text-ink-muted">
                        {when(run.startedAt)}
                        {run.startedBy ? ` · ${run.startedBy}` : ''}
                      </span>
                    </span>
                  </span>
                </th>
                <td className={`${TD} max-w-[220px] truncate`}>{run.companyName}</td>
                <td className={TD}>
                  <Tag tone={run.route === 'api' ? 'violet' : 'idle'}>{ROUTE_LABEL[run.route]}</Tag>
                </td>
                <td className={TD}>
                  <span className="flex min-w-[180px] flex-col gap-1">
                    <AgentStateChip run={run} className="self-start" />
                    {pct !== null ? <ProgressBar value={pct} label={`${run.fieldsDone} of ${run.fieldsTotal} fields`} className="max-w-[160px]" /> : null}
                    {run.error ? <span className="text-[12px] text-danger">{run.error.slice(0, 60)}</span> : null}
                  </span>
                </td>
                <td className={`${TD} text-right tabular-nums`}>{run.minutes} m</td>
                <td className={`${TD} font-mono text-[12.5px]`}>{run.result ?? '—'}</td>
                <td className={TD}>
                  <CertifierCell assist={assist} onOpen={() => onOpen(run)} />
                </td>
                <td className={`${TD} pr-4 text-right`}>
                  {run.href ? (
                    <Link href={run.href} className={buttonVariants({ size: 'sm', variant: run.action === 'Fix' ? 'outline' : 'soft' })}>
                      {run.action}
                      <span className="sr-only"> {run.agentName}</span>
                    </Link>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PatchRow({ patch, canReview }: { patch: AssistPatchView; canReview: boolean }) {
  const review = useReviewAssistPatch();
  const look = PATCH_LOOK[patch.status];
  const decide = (decision: 'approved' | 'rejected') =>
    review.mutate(
      { id: patch.id, decision },
      {
        onSuccess: () => toastSuccess(decision === 'approved' ? 'Fix approved' : 'Fix rejected', 'Approved fixes go into the next recipe version.'),
        onError: (err) => toastError('Could not save the decision', err.message),
      },
    );
  const target = patch.proposed.som ?? patch.proposed.css ?? patch.proposed.label ?? '';
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line-soft px-4 py-3 first:border-t-0">
      <span className="flex-none">
        <Chip raw tone={look.tone} className="min-w-[104px]">
          {look.label}
        </Chip>
      </span>
      <span className="min-w-0 flex-1 basis-[280px]">
        <span className="block truncate text-[14px] text-ink">
          {patch.evidence.fieldLabel ?? patch.fieldKey}
          <span className="ml-2 font-mono text-[11.5px] text-ink-muted">
            {patch.recipeId}@{patch.recipeVersion}
          </span>
        </span>
        <span className="mt-0.5 block truncate font-mono text-[12px] text-ink-muted" title={target}>
          {target}
        </span>
        {patch.evidence.chosenLabel ? (
          <span className="mt-0.5 block truncate text-[12.5px] text-ink-muted">Matched “{patch.evidence.chosenLabel}”</span>
        ) : null}
      </span>
      <Tag tone={patch.sourceTier === 'T3' ? 'violet' : 'idle'}>{patch.sourceTier}</Tag>
      {canReview && patch.status === 'proposed' ? (
        <span className="flex flex-none gap-2">
          <Button size="sm" variant="success" disabled={review.isPending} onClick={() => decide('approved')}>
            Approve
          </Button>
          <Button size="sm" variant="quiet" disabled={review.isPending} onClick={() => decide('rejected')}>
            Reject
          </Button>
        </span>
      ) : null}
    </li>
  );
}

export default function AssistRunsPage() {
  const { user } = useApp();
  const canReview = isAdminOrManager(user?.role);
  const firmAdmin = isFirmWideAdmin(user?.role);
  const [view, setView] = useState<AssistPatchStatus | 'all'>('proposed');
  const [filters, setFilters] = useState<AgentRunFilters>({ state: 'all', period: 'week', agent: null, search: '' });
  const [search, setSearch] = useState('');
  const listQuery = useAgentRunsList(filters);
  const assistQuery = useAssistAgentRuns();
  const patchesQuery = useAssistPatches(view);
  const runs = useMemo(() => listQuery.data?.runs ?? [], [listQuery.data]);
  const agents = listQuery.data?.agents ?? [];
  const assistRuns = useMemo(() => assistQuery.data?.runs ?? [], [assistQuery.data]);
  const assistById = useMemo(() => new Map(assistRuns.map((r) => [r.id, r])), [assistRuns]);
  const patches = patchesQuery.data?.patches ?? [];
  const filled = runs.reduce((sum, r) => sum + r.fieldsDone, 0);
  const yourTurn = runs.filter((r) => r.bucket === 'your_turn').length;
  const tokens = assistRuns.reduce((sum, r) => sum + r.aiTokens, 0);
  const aiFree = assistRuns.filter((r) => r.aiCalls === 0).length;
  const [openAssistId, setOpenAssistId] = useState<string | null>(null);
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  useEffect(() => {
    // The side panel's "Open in Suite" lands here with ?run=<id> (`assistRunPath`).
    const id = new URLSearchParams(window.location.search).get('run');
    if (id) setOpenAssistId(id);
    const first = filtersFromUrl();
    if (first.state !== 'all' || first.period !== 'week') setFilters((f) => ({ ...f, ...first }));
  }, []);
  useEffect(() => {
    // The search waits for a pause in typing before it asks the server again.
    const t = window.setTimeout(() => setFilters((f) => (f.search === search.trim() ? f : { ...f, search: search.trim() })), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const openAssist = (openAssistId && assistById.get(openAssistId)) || null;
  const openRun = runs.find((r) => r.id === openRunId) ?? null;
  const open = (run: AgentRunItem) => {
    if (run.source === 'extension' && run.assistRunId && assistById.has(run.assistRunId)) setOpenAssistId(run.assistRunId);
    else setOpenRunId(run.id);
  };
  const agentOptions = [
    { value: '', label: 'All agents' },
    ...(filters.agent && !agents.some((a) => a.taskId === filters.agent) ? [{ value: filters.agent, label: filters.agent }] : []),
    ...agents.map((a) => ({ value: a.taskId, label: `${a.name} (${a.count})` })),
  ];
  const seg = roleAppSegment(user?.role);
  const filtered = filters.state !== 'all' || filters.agent !== null || filters.search !== '';

  return (
    <div className="grid min-w-0 gap-4">
      <DashHero
        title="Agent runs"
        subtitle="Every card agent run in your scope: the live browser, the VCFO Assist side panel and the GST returns filed through the API."
        stats={[
          { label: 'Runs', icon: Bot, value: runs.length },
          { label: 'Your turn', icon: Hand, value: yourTurn },
          { label: 'Fields filled', icon: Wand2, value: number(filled) },
          { label: 'Runs with no AI call', value: aiFree, of: `/ ${assistRuns.length}` },
          { label: 'Tokens', icon: Coins, value: number(tokens) },
        ]}
      >
        {firmAdmin ? (
          <span className="flex flex-wrap gap-2">
            <Link href={`/app/${seg}/agent-results`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
              Agent results
            </Link>
            <Link href={`/app/${seg}/agent-settings`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
              <Settings aria-hidden />
              Agent settings
            </Link>
          </span>
        ) : null}
      </DashHero>

      <DashSection title="Recent runs" meta={listQuery.isLoading ? undefined : runs.length} flush>
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-2.5 md:px-5" role="group" aria-label="Filters">
          <FilterSelect
            aria-label="State"
            options={STATE_OPTIONS}
            value={filters.state}
            onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value as AgentRunStateFilter }))}
          />
          <FilterSelect
            aria-label="Period"
            options={PERIOD_OPTIONS}
            value={filters.period}
            onChange={(e) => setFilters((f) => ({ ...f, period: e.target.value as AgentRunPeriod }))}
          />
          <FilterSelect aria-label="Agent" options={agentOptions} value={filters.agent ?? ''} onChange={(e) => setFilters((f) => ({ ...f, agent: e.target.value || null }))} />
          <Input
            type="search"
            aria-label="Search runs"
            placeholder="Search client, agent or result"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-control-sm w-full text-[13px] sm:ml-auto sm:w-[260px]"
          />
        </div>
        {listQuery.isLoading ? (
          <SkeletonRows />
        ) : listQuery.isError ? (
          <p role="alert" className="m-4 rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
            Could not load the runs. Refresh the page.
          </p>
        ) : runs.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={filtered ? 'No runs match these filters' : 'No agent runs yet'}
              action={
                filtered ? undefined : (
                  <span className="max-w-[460px] text-[13px]">
                    A run shows here when an agent fills a portal form, in the live browser or with the VCFO Assist side panel in Chrome, or
                    files a GST return through the API.
                  </span>
                )
              }
            />
          </div>
        ) : (
          <RunsTable runs={runs} assistById={assistById} onOpen={open} />
        )}
      </DashSection>
      <AssistRunDetail key={openAssist?.id ?? 'none'} run={openAssist} onOpenChange={(o) => !o && setOpenAssistId(null)} />
      <AgentRunDetail
        run={openRun}
        onOpenChange={(o) => !o && setOpenRunId(null)}
        onOpenEvidence={
          openRun?.assistRunId && assistById.has(openRun.assistRunId)
            ? (id) => {
                setOpenRunId(null);
                setOpenAssistId(id);
              }
            : undefined
        }
      />

      <DashSection
        id="recipe-fixes"
        title="Recipe fixes"
        meta={patchesQuery.isLoading ? undefined : patches.length}
        flush
        right={
          <FilterSelect
            aria-label="Which fixes"
            options={PATCH_VIEWS}
            value={view}
            onChange={(event) => setView(event.target.value as AssistPatchStatus | 'all')}
          />
        }
      >
        {patchesQuery.isLoading ? (
          <SkeletonRows />
        ) : patches.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={view === 'proposed' ? 'No fixes waiting for review' : 'No fixes here'}
              action={
                view === 'proposed' ? (
                  <span className="max-w-[460px] text-[13px]">When an agent finds a better way to reach a field, it proposes the fix here.</span>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ul>
            {patches.map((patch) => (
              <PatchRow key={patch.id} patch={patch} canReview={canReview} />
            ))}
          </ul>
        )}
      </DashSection>
    </div>
  );
}
