'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronLeft, Landmark } from 'lucide-react';
import type {
  ClientOverviewMilestone,
  ClientOverviewProgress,
} from '@/lib/client-overview';
import type { PhaseColorKey } from '@/lib/phase-colors';
import { clientIncorporationStepPath } from '@/lib/project-step-path';
import { cn } from '@/lib/utils';
import { CardHeading } from '@/components/client/overview/CardHeading';
import { ProgressRing } from '@/components/client/overview/ProgressRing';

/** Four hues far enough apart that Part B never reads as post-incorporation (oklch triplets). */
const PHASE_HUE: Record<PhaseColorKey, string> = {
  pre: '48% 0.19 255',
  filing: '55% 0.14 175',
  post: '62% 0.16 55',
  fema: '55% 0.2 25',
  registration: '50% 0.18 305',
  default: '45% 0.02 255',
};

/**
 * Four phase cards. A click replaces them with that phase’s steps, laid out
 * across the width. The steps do not drop down under the cards.
 */
export function ClientPhaseBars({
  progress,
  milestones,
  incorporated,
  heading: headingOverride,
  metaForPhase,
  trailingForPhase,
}: {
  progress: ClientOverviewProgress;
  milestones: ClientOverviewMilestone[];
  incorporated: boolean;
  heading?: string;
  /** Inline detail inside the card, e.g. the scheduled date window. */
  metaForPhase?: (phaseId: string) => ReactNode;
  /** Interactive extra under the card (kept outside the card's button). */
  trailingForPhase?: (phaseId: string) => ReactNode;
}) {
  const currentIndex = progress.byPhase.findIndex((phase) => phase.pct < 100);
  const [openPhaseId, setOpenPhaseId] = useState<string | null>(null);
  const openPhase = progress.byPhase.find((phase) => phase.id === openPhaseId) ?? null;
  const openSteps = milestones.filter((step) => step.phaseId === openPhaseId);
  const heading = headingOverride ?? (incorporated ? 'Where we are' : 'Incorporation');

  if (openPhase) {
    return (
      <section>
        <div className="flex items-center gap-3 px-5 py-3">
          <button
            type="button"
            onClick={() => setOpenPhaseId(null)}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-[13px] font-medium text-foreground hover:bg-muted/60"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Back to phases
          </button>
          <h2 className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-foreground">
            {openPhase.label}
          </h2>
          <span className="text-[13px] font-semibold tabular-nums text-foreground">
            {openPhase.done}/{openPhase.total}
          </span>
        </div>
        <PhaseSteps steps={openSteps} />
      </section>
    );
  }

  return (
    <section>
      <CardHeading icon={Landmark} hue="var(--primary)" title={heading} className="px-5 pb-3 pt-4" />
      <ol className="grid grid-cols-2 gap-2.5 px-5 pb-4 lg:grid-cols-4">
        {progress.byPhase.map((phase, index) => {
          const isCurrent = index === currentIndex;
          const isDone = phase.pct >= 100;
          const steps = milestones.filter((step) => step.phaseId === phase.id);
          const focus = focusLine(steps);
          const meta = metaForPhase?.(phase.id);
          const trailing = trailingForPhase?.(phase.id);
          const hue = PHASE_HUE[phase.colorKey];

          return (
            <li
              key={phase.id}
              style={{ '--ph': hue, '--live': hue, '--rise': 6 + index } as CSSProperties}
              className={cn(
                'client-rise relative flex flex-col rounded-xl border bg-panel transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-18px_oklch(var(--ph))]',
                isCurrent
                  ? 'border-[oklch(var(--ph)/0.45)] bg-[linear-gradient(160deg,oklch(var(--ph)/0.1),transparent_60%)] shadow-[0_10px_24px_-18px_oklch(var(--ph))]'
                  : 'border-border',
              )}
            >
              <span
                className={cn('absolute inset-x-0 -top-px h-1 rounded-t-xl', isDone || isCurrent ? 'bg-[oklch(var(--ph))]' : 'bg-[oklch(var(--ph)/0.25)]')}
                aria-hidden
              />
              <button
                type="button"
                aria-label={phase.label}
                onClick={() => setOpenPhaseId(phase.id)}
                className="flex w-full flex-1 flex-col gap-2 px-4 pb-3.5 pt-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
              >
                <span className="flex items-center justify-between gap-2">
                  <ProgressRing
                    pct={phase.pct}
                    size={46}
                    stroke={5}
                    color={`oklch(${hue})`}
                    track={`oklch(${hue} / 0.15)`}
                    label={`${phase.label}: ${phase.pct}% complete`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-[oklch(var(--ph))]" strokeWidth={2.25} aria-hidden />
                    ) : (
                      <span className="text-[11px] font-bold tabular-nums text-foreground">{phase.pct}%</span>
                    )}
                  </ProgressRing>
                  <span className="text-right">
                    <span className="block text-[18px] font-bold leading-none tabular-nums text-foreground">
                      {phase.done}
                      <span className="text-[13px] font-semibold text-muted-foreground">/{phase.total}</span>
                    </span>
                    <span className="mt-0.5 block text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">steps</span>
                  </span>
                </span>
                <span className="text-[14px] font-bold leading-snug text-foreground">{phase.label}</span>
                {isDone ? (
                  <span className="w-fit rounded-full bg-success-light px-2 py-0.5 text-[11px] font-bold text-success-text">
                    Complete
                  </span>
                ) : isCurrent ? (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[oklch(var(--ph))] px-2 py-0.5 text-[11px] font-bold text-white">
                    <span className="client-live h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
                    In progress
                  </span>
                ) : (
                  <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Not started</span>
                )}
                <span className="line-clamp-2 text-[12px] font-medium leading-snug text-muted-foreground">{focus}</span>
                {meta}
              </button>
              {trailing ? <div className="px-4 pb-3">{trailing}</div> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function focusLine(steps: ClientOverviewMilestone[]): string {
  const live = steps.find((step) => step.kind === 'active' || step.kind === 'waiting');
  if (live) return live.title;
  if (steps.length > 0 && steps.every((step) => step.kind === 'done')) return 'All steps done';
  const next = steps.find((step) => step.kind !== 'done');
  return next?.title ?? 'All steps done';
}

function PhaseSteps({ steps }: { steps: ClientOverviewMilestone[] }) {
  if (steps.length === 0) return null;

  return (
    <ul className="grid grid-cols-1 border-t border-border sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((step) => {
        const word =
          step.kind === 'done'
            ? 'Completed'
            : step.kind === 'active'
              ? 'Your turn'
              : step.kind === 'waiting'
                ? 'With the team'
                : 'Upcoming';
        const statusColor =
          step.kind === 'done'
            ? 'font-semibold text-success-text'
            : step.kind === 'active'
              ? 'font-semibold text-primary'
              : step.kind === 'waiting'
                ? 'font-semibold text-warning-text'
                : 'text-muted-foreground';
        const openable = step.kind !== 'locked';
        const body = (
          <>
            <span className="min-w-0 text-[13.5px] font-medium leading-snug text-foreground">{step.title}</span>
            <span className={cn('text-[12px]', statusColor)}>{word}</span>
          </>
        );
        return (
          <li
            key={step.id}
            className="border-b border-border bg-panel sm:[&:nth-child(odd)]:border-r lg:border-r lg:[&:nth-child(3n)]:border-r-0"
          >
            {openable ? (
              <Link
                href={clientIncorporationStepPath(step.id)}
                className="flex min-h-[4.25rem] flex-col justify-center gap-1 px-5 py-3 hover:bg-muted/50"
              >
                {body}
              </Link>
            ) : (
              <span className="flex min-h-[4.25rem] flex-col justify-center gap-1 px-5 py-3">{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
