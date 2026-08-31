'use client';

import Link from 'next/link';
import { Flag } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { JourneyNode } from '@/components/incorporation/JourneyNode';
import { TONE_BADGE } from '@/components/common/IconChip';
import { phaseFill } from '@/components/super/overview/super-overview-format';
import type { SuperEngagementDetail, SuperJourneyStep } from '@/lib/super-overview';
import { cn } from '@/lib/utils';

/**
 * The whole 34-step journey for one engagement, as the firm sees it.
 *
 * Node language is `JourneyNode` — the same component the client journey and
 * the lead rail use — driven by the same `gateActiveCatalog` result. A locked
 * step shows the lock and no way in; this surface never unlocks anything.
 */
export function SuperProjectJourney({ detail }: { detail: SuperEngagementDetail }) {
  const groups = groupByPhase(detail.journey);
  const { progress } = detail.summary;

  return (
    <DashSection
      icon={Flag}
      tone="sky"
      title="Journey"
      meta={`${progress.done} of ${progress.total} steps`}
      bodyClassName="px-4 pb-3 pt-2.5 max-h-[34rem] overflow-y-auto"
    >
      {groups.map((group) => {
        const done = group.steps.filter((step) => step.kind === 'done').length;
        return (
          <section key={group.phaseId} className="mt-3 first:mt-0">
            <div className="mb-1.5 flex min-w-0 items-center gap-2">
              <i
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: phaseFill(group.phaseId) }}
                aria-hidden
              />
              <h3 className="min-w-0 truncate text-[11px] font-extrabold uppercase tracking-[0.06em] text-ink">
                {group.phaseLabel}
              </h3>
              <span className="ml-auto shrink-0 font-mono text-[10.5px] font-semibold text-text-tertiary">
                {done}/{group.steps.length}
              </span>
            </div>

            <ol className="relative pt-0.5">
              <span className="client-rail-line" aria-hidden />
              {group.steps.map((step, index) => (
                <JourneyRow key={step.id} step={step} stepNumber={index + 1} />
              ))}
            </ol>
          </section>
        );
      })}
    </DashSection>
  );
}

function JourneyRow({ step, stepNumber }: { step: SuperJourneyStep; stepNumber: number }) {
  const open = step.kind === 'active' || step.kind === 'waiting';

  return (
    <li className="relative flex gap-3.5 pb-3 last:pb-0">
      <JourneyNode
        kind={step.kind}
        stepNumber={stepNumber}
        size="sm"
        className="mt-0.5 h-[30px] w-[30px]"
      />
      <div className="min-w-0 flex-1">
        <Link
          href={step.href}
          title={step.title}
          className={cn(
            'block min-w-0 truncate text-[12.5px] leading-snug hover:underline',
            step.kind === 'done' && 'font-bold text-ink',
            open && 'font-extrabold text-ink',
            step.kind === 'locked' && 'font-medium text-muted-foreground',
          )}
        >
          {step.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              'rounded-full px-1.5 py-px text-[9.5px] font-extrabold uppercase tracking-wide',
              TONE_BADGE[STEP_TONE[step.kind]],
            )}
          >
            {STEP_LABEL[step.kind]}
          </span>
          {step.awaitingReview ? (
            <span className={cn('rounded-full px-1.5 py-px text-[9.5px] font-extrabold uppercase tracking-wide', TONE_BADGE.pink)}>
              PM review
            </span>
          ) : null}
          {step.rejected ? (
            <span className={cn('rounded-full px-1.5 py-px text-[9.5px] font-extrabold uppercase tracking-wide', TONE_BADGE.danger)}>
              Sent back
            </span>
          ) : null}
          {open ? (
            <span className="text-[10.5px] font-bold text-muted-foreground">
              {step.owner === 'client' ? 'With the client' : 'With the firm'}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

const STEP_LABEL: Record<SuperJourneyStep['kind'], string> = {
  done: 'Complete',
  active: 'In progress',
  waiting: 'Waiting',
  locked: 'Not open yet',
};

const STEP_TONE: Record<SuperJourneyStep['kind'], 'success' | 'primary' | 'orange' | 'neutral'> = {
  done: 'success',
  active: 'primary',
  waiting: 'orange',
  locked: 'neutral',
};

function groupByPhase(steps: SuperJourneyStep[]) {
  const groups: { phaseId: string; phaseLabel: string; steps: SuperJourneyStep[] }[] = [];
  for (const step of steps) {
    let group = groups.find((entry) => entry.phaseId === step.phaseId);
    if (!group) {
      group = { phaseId: step.phaseId, phaseLabel: step.phaseLabel, steps: [] };
      groups.push(group);
    }
    group.steps.push(step);
  }
  return groups;
}
