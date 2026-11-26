'use client';

import Link from 'next/link';
import { Bot } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button-variants';
import { Chip, type ChipTone } from '@/components/ui/spectrum-chip';
import { ProgressBar } from '@/components/common/ProgressBar';
import { CARD_AGENT_COLOUR } from '@/lib/card-agents/card-agents';
import { findSubAgent } from '@/lib/assist-agents/catalog';
import type { AgentRunBucket, AgentRunItem } from '@/lib/card-agents/overview';
import { cn } from '@/lib/utils';

/**
 * Small parts shared by "Agents today" and the control room: the state chip, the robot mark and
 * the compact run row with its Open, Watch or Fix link to the card page.
 */

export const BUCKET_TONE: Record<AgentRunBucket, ChipTone> = {
  your_turn: 'teal',
  running: 'prog',
  waiting: 'warn',
  done: 'ok',
  failed: 'bad',
  cancelled: 'idle',
};

export function AgentStateChip({ run, className }: { run: Pick<AgentRunItem, 'bucket' | 'stateLabel'>; className?: string }) {
  return (
    <Chip raw tone={BUCKET_TONE[run.bucket]} className={className}>
      {run.stateLabel}
    </Chip>
  );
}

/** The robot: the agent's own data colour on the glyph, a neutral tile behind it. */
export function AgentMark({ taskId }: { taskId: string }) {
  const task = findSubAgent(taskId);
  return (
    <span className="grid h-7 w-7 flex-none place-items-center rounded-md bg-surface-sunken" aria-hidden>
      <Bot className="h-4 w-4" strokeWidth={1.75} style={{ color: task ? CARD_AGENT_COLOUR[task.agent] : undefined }} />
    </span>
  );
}

export const ROUTE_LABEL = { browser: 'Browser', api: 'API' } as const;

/** Percent of fields done, or null when the run does not count fields. */
export function fieldsPercent(run: Pick<AgentRunItem, 'fieldsDone' | 'fieldsTotal'>): number | null {
  return run.fieldsTotal > 0 ? Math.round((run.fieldsDone / run.fieldsTotal) * 100) : null;
}

/** One compact run row (Agents today): robot, agent, client, state, progress and the action. */
export function AgentRunRow({ run }: { run: AgentRunItem }) {
  const pct = run.bucket === 'running' ? fieldsPercent(run) : null;
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line-soft px-4 py-2.5 first:border-t-0">
      <AgentMark taskId={run.taskId} />
      <span className="min-w-0 flex-1 basis-[200px]">
        <span className="block truncate text-[13.5px] font-medium text-ink">{run.agentName}</span>
        <span className="block truncate text-[12px] text-ink-muted">{run.companyName}</span>
      </span>
      <span className="flex min-w-0 flex-none basis-[220px] flex-col gap-1">
        <span className="truncate text-[12.5px] text-ink-2">{run.progressText ?? run.stateLabel}</span>
        {pct !== null ? <ProgressBar value={pct} label={`${run.fieldsDone} of ${run.fieldsTotal} fields`} /> : null}
      </span>
      {run.href ? (
        <Link href={run.href} className={cn(buttonVariants({ size: 'sm', variant: run.action === 'Fix' ? 'outline' : 'soft' }), 'min-w-[72px]')}>
          {run.action}
          <span className="sr-only">
            {' '}
            {run.agentName} for {run.companyName}
          </span>
        </Link>
      ) : null}
    </li>
  );
}
