'use client';

import { ChevronRight } from 'lucide-react';
import type { ChecklistItem } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import type { ChecklistStepGate } from '@/lib/checklist-step-gate';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import { InternStepDoneMark } from '@/components/incorporation/InternStepDoneMark';
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
 */
export function ChecklistPhaseStepRow({
  item,
  gate,
  responses,
  engagement,
  onOpen,
  showBoardResolutionLink = true,
}: {
  item: ChecklistItem;
  gate: ChecklistStepGate;
  responses?: ChecklistItemResponses;
  engagement: Engagement;
  onOpen: (item: ChecklistItem) => void;
  /** pre-2 carries a link into the board-resolution editor on the lead side. */
  showBoardResolutionLink?: boolean;
}) {
  const waiting = gate.kind === 'waiting';
  const yourTurn = gate.kind === 'active';

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        'group grid min-h-11 w-full grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-border px-4 py-3.5 text-left transition-colors last:border-0',
        waiting && 'bg-warning-light/80 hover:bg-warning-light',
        yourTurn && 'bg-primary-light/80 hover:bg-primary-light',
        !waiting && !yourTurn && 'hover:bg-raised/40',
      )}
    >
      <InternStepDoneMark done={gate.kind === 'done'} />
      <div className="min-w-0">
        <div className={cn('text-[13px]', yourTurn ? 'font-medium text-primary' : 'text-ink')}>
          {item.title}
        </div>
        {waiting && gate.message ? (
          <div className="mt-0.5 text-[11px] text-warning-text">{gate.message}</div>
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
      <ChevronRight className="h-3.5 w-3.5 text-text-tertiary transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
    </button>
  );
}
