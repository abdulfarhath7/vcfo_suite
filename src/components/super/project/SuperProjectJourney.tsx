'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DashSection } from '@/components/dash/DashSection';
import { Chip, OwnerChip } from '@/components/ui/spectrum-chip';
import { PhaseBar, StepMark, type StepTone } from '@/components/ui/step-track';
import { superPhaseTrack } from '@/components/super/overview/super-overview-format';
import { SUPER_PROJECTS_HREF, type SuperEngagementDetail, type SuperJourneyStep } from '@/lib/super/super-overview';
import { StepAboutPanel } from '@/views/client-record/StepAboutPanel';
import { cn } from '@/lib/utils';

/**
 * The whole journey for one engagement, as the firm sees it (ST5, rule R-22).
 *
 * The phase track sits on top: four bars sized by step count, done green, the current phase
 * blurple with a soft ring. Under it, each phase lists its steps with the ST5 mark: a done step
 * is a green square with a tick, the live step a ring with a status square, a later step a
 * dashed square. The live step shows who holds it, the lead and the status chip. Every state
 * comes from the same `gateActiveCatalog` result the wizard uses; a locked step stays locked.
 * "What's this?" on a row opens the step's About panel (P-095, the staff `StepAboutPanel`), and
 * the board resolution step links to the super admin's editor (P-112).
 */
export function SuperProjectJourney({ detail }: { detail: SuperEngagementDetail }) {
  const groups = groupByPhase(detail.journey);
  const { progress } = detail.summary;
  const track = superPhaseTrack(detail.summary);
  const current = track.totals.findIndex((t, i) => (track.done[i] ?? 0) < t);
  const liveIndex = detail.summary.currentStep ? detail.journey.findIndex((step) => step.id === detail.summary.currentStep?.id) : -1;
  const live = liveIndex >= 0 ? detail.journey[liveIndex] : undefined;
  const [about, setAbout] = useState<{ id: string; label: string } | null>(null);
  const boardResolutionHref = `${SUPER_PROJECTS_HREF}/${encodeURIComponent(detail.summary.id)}/board-resolution`;

  return (
    <DashSection
      title="Steps"
      meta={liveIndex >= 0 ? `${progress.done} of ${progress.total} steps · Step ${liveIndex + 1} of ${detail.journey.length}` : `${progress.done} of ${progress.total} steps`}
      href={live?.href}
      hrefLabel={live ? 'Open current step' : undefined}
      bodyClassName="p-0"
    >
      <ol className="hidden gap-2 border-b border-line-soft px-4 py-4 sm:flex" aria-label="Phases">
        {track.totals.map((total, i) => {
          const done = track.done[i] ?? 0;
          const state = done >= total ? 'done' : i === current ? 'now' : 'next';
          return (
            <li key={track.names[i]} className="flex min-w-0 flex-col gap-[7px]" style={{ flex: `${Math.max(total, 1)} 1 0` }}>
              <span className={cn('truncate text-[13px] font-medium', state === 'next' ? 'text-ink-muted' : 'text-ink')}>{track.names[i]}</span>
              <span className={cn('relative h-2.5 overflow-hidden rounded-bar bg-surface-sunken', state === 'now' && 'ring-[1.5px] ring-brand-line')}>
                <i
                  className={cn('absolute inset-y-0 left-0 rounded-bar', state === 'done' ? 'bg-positive-mid' : 'bg-brand')}
                  style={{ width: done ? `max(${(done / Math.max(total, 1)) * 100}%, 6px)` : 0 }}
                />
              </span>
              <span className={cn('text-[12px] font-medium tabular-nums', state === 'done' ? 'text-positive' : state === 'now' ? 'text-brand-text' : 'text-ink-muted')}>
                {done}/{total}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex items-center gap-3 border-b border-line-soft px-4 py-3 sm:hidden">
        <PhaseBar done={track.done} totals={track.totals} names={track.names} className="flex-1" />
        <span className="text-[12.5px] tabular-nums text-ink-muted">
          {progress.done}/{progress.total}
        </span>
      </div>

      <div className="max-h-[40rem] overflow-y-auto">
        {groups.map((group) => {
          const done = group.steps.filter((step) => step.kind === 'done').length;
          return (
            <section key={group.phaseId} className="border-b border-line-soft last:border-b-0">
              <div className="flex min-w-0 items-center gap-2 px-4 pb-1.5 pt-3">
                <h3 className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{group.phaseLabel}</h3>
                <span className="shrink-0 text-[12px] tabular-nums text-ink-muted">
                  {done}/{group.steps.length}
                </span>
              </div>
              <ol className="pb-2">
                {group.steps.map((step) => (
                  <JourneyRow
                    key={step.id}
                    step={step}
                    leadName={detail.summary.leadName}
                    boardResolutionHref={step.id === 'pre-2' ? boardResolutionHref : undefined}
                    onAbout={() => setAbout({ id: step.id, label: `Step ${detail.journey.indexOf(step) + 1}` })}
                  />
                ))}
              </ol>
            </section>
          );
        })}
      </div>
      <StepAboutPanel
        stepId={about?.id ?? null}
        stepLabel={about?.label}
        engagementId={detail.summary.id}
        onClose={() => setAbout(null)}
      />
    </DashSection>
  );
}

function markTone(step: SuperJourneyStep): StepTone {
  if (step.rejected) return 'bad';
  if (step.kind === 'waiting' || step.awaitingReview) return 'teal';
  return 'prog';
}

function statusWord(step: SuperJourneyStep): string {
  if (step.status === 'not-applicable') return 'Not needed';
  if (step.rejected) return 'Sent back';
  if (step.awaitingReview) return 'Waiting';
  if (step.kind === 'done') return 'Done';
  if (step.kind === 'waiting') return 'Waiting';
  if (step.kind === 'active') return 'In progress';
  return 'Not started';
}

function JourneyRow({
  step,
  leadName,
  boardResolutionHref,
  onAbout,
}: {
  step: SuperJourneyStep;
  leadName: string | null;
  boardResolutionHref?: string;
  onAbout: () => void;
}) {
  const open = step.kind === 'active' || step.kind === 'waiting';
  const state = step.kind === 'done' ? 'done' : open ? 'now' : 'next';

  return (
    <li className={cn('flex min-w-0 items-center gap-3 px-4 py-2', open && 'bg-brand-soft/40')}>
      <StepMark state={state} tone={markTone(step)} label={statusWord(step)} />
      <span className="min-w-0 flex-1">
        <Link
          href={step.href}
          title={step.title}
          className={cn(
            'block min-w-0 truncate text-[13.5px] leading-snug hover:underline',
            step.kind === 'locked' ? 'text-ink-muted' : 'font-medium text-ink',
          )}
        >
          {step.title}
        </Link>
        {open ? (
          <span className="block truncate text-[12px] text-ink-muted">{leadName ? `Lead ${leadName}` : 'No lead'}</span>
        ) : null}
        {boardResolutionHref ? (
          <Link href={boardResolutionHref} className="block text-[12px] font-medium text-brand-text hover:underline">
            Board resolution
          </Link>
        ) : null}
      </span>
      <button
        type="button"
        onClick={onAbout}
        className="hidden flex-none whitespace-nowrap text-[12px] font-medium text-brand-text hover:underline sm:inline"
      >
        What&apos;s this?
      </button>
      {open ? (
        <>
          <OwnerChip owner={step.awaitingReview ? 'manager' : step.owner === 'client' ? 'client' : 'sbc'} className="hidden sm:inline-flex" />
          <Chip fixed tone={step.rejected ? 'bad' : step.kind === 'waiting' || step.awaitingReview ? 'teal' : 'prog'} title={step.awaitingReview ? 'PM review' : undefined}>
            {statusWord(step)}
          </Chip>
        </>
      ) : null}
    </li>
  );
}

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
