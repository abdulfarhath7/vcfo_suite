'use client';

import { ChevronRight } from 'lucide-react';
import type { ChecklistItem } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import type { ChecklistStepGate } from '@/lib/checklist/checklist-step-gate';
import type { ChecklistItemResponses } from '@/lib/checklist/checklist-responses';
import { StepMark } from '@/components/ui/step-track';
import { stepMarkForGate } from '@/components/incorporation/step-mark-for-gate';
import { BoardResolutionStepLink } from '@/components/incorporation/BoardResolutionStepLink';
import { MilestoneResponseRowSummary } from '@/views/incorporation/MilestoneResponseRowSummary';
import { cn } from '@/lib/utils';

/**
 * One step row inside a phase.
 *
 * Extracted from the lead dashboard's engagement detail so the client portal
 * renders the SAME row rather than a lookalike: same done mark, same tinted
 * "your turn" / "waiting" states, same response summary, same chevron.
 *
 * Every row opens. Nothing here is locked for viewing — the done mark and the
 * phase rail carry progress, and the sequential gate governs what the viewer may
 * DO on the step, not whether they may read it.
 *
 * VCFO Spectrum (R-22, ST5): the mark is the 22px step square. A done step is green with a tick,
 * the open step is a ring with a halo and a soft row tint, and a locked step is a dashed square.
 */
export function ChecklistPhaseStepRow({
  item,
  gate,
  responses,
  engagement,
  onOpen,
  showBoardResolutionLink = true,
  stepNumber,
}: {
  item: ChecklistItem;
  gate: ChecklistStepGate;
  responses?: ChecklistItemResponses;
  engagement: Engagement;
  onOpen: (item: ChecklistItem) => void;
  /** pre-2 carries a link into the board-resolution editor on the lead side. */
  showBoardResolutionLink?: boolean;
  /** Step number inside its phase, shown as a mono "Step n" before the title. */
  stepNumber?: number;
}) {
  const waiting = gate.kind === 'waiting';
  const yourTurn = gate.kind === 'active';
  const mark = stepMarkForGate(gate);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        'group grid min-h-11 w-full grid-cols-[22px_1fr_auto] items-center gap-3 border-b border-line-soft px-4 py-2.5 text-left transition-colors last:border-0',
        (waiting || yourTurn) ? 'bg-surface-sunken/70 hover:bg-surface-sunken' : 'hover:bg-surface-sunken/50',
      )}
    >
      <StepMark state={mark.state} tone={mark.tone} label={mark.label} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          {stepNumber !== undefined ? (
            <span className="flex-none font-mono text-[12px] text-ink-muted">Step {stepNumber}</span>
          ) : null}
          <span
            className={cn(
              'min-w-0 text-[14px]',
              yourTurn || waiting ? 'font-medium text-ink' : mark.state === 'next' ? 'text-ink-2' : 'text-ink',
            )}
          >
            {item.title}
          </span>
        </div>
        {waiting && gate.message ? (
          <div className="mt-0.5 text-[12.5px] text-waiting">{gate.message}</div>
        ) : null}
        <MilestoneResponseRowSummary
          item={item}
          responses={responses}
          variant="admin"
          hideStatus
        />
        {showBoardResolutionLink && item.id === 'pre-2' ? (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- propagation guard, not an interaction: keeps clicks on the nested link from firing the row button. A role here would add a stray tab stop.
          <div
            className="mt-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <BoardResolutionStepLink engagement={engagement} />
          </div>
        ) : null}
      </div>
      <ChevronRight className="h-4 w-4 text-ink-faint" strokeWidth={1.6} aria-hidden />
    </button>
  );
}
