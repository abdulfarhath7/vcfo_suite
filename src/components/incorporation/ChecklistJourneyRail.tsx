'use client';

import type { ChecklistItem } from '@/data/checklist';
import type { StatusCode } from '@/data/checklist';
import { StatusBadgeWithTimeline } from '@/components/incorporation/ChecklistExpectedTimeline';
import { JourneyNode } from '@/components/incorporation/JourneyNode';
import { ResponsibleRoleBadge } from '@/components/incorporation/ResponsibleRoleBadge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ChecklistStepGate } from '@/lib/checklist-step-gate';
import { gateDisplayStatus } from '@/lib/checklist-step-gate';
import { toastInfo } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';
import { Lock } from 'lucide-react';

export function notifyChecklistStepLocked(message: string | null) {
  toastInfo(message ?? 'This opens after the previous step is complete.');
}

export function ChecklistLockedHint({
  message,
  children,
}: {
  message: string;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="flex gap-2.5">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-sm leading-relaxed text-foreground">{message}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface JourneyRailItem {
  item: ChecklistItem;
  gate: ChecklistStepGate;
  status: StatusCode;
  stepNumber: number;
  phaseId?: string;
}

interface ChecklistJourneyRailProps {
  items: JourneyRailItem[];
  selectedId: string | null;
  onSelect: (itemId: string) => void;
  className?: string;
}

/** Sticky vertical stepper: solid connector through done, dashed through locked. */
export function ChecklistJourneyRail({
  items,
  selectedId,
  onSelect,
  className,
}: ChecklistJourneyRailProps) {
  return (
    <nav aria-label="Checklist steps" className={cn('relative', className)}>
      <ol className="space-y-0">
        {items.map((row, index) => {
          const { item, gate, status, stepNumber } = row;
          const selected = selectedId === item.id;
          const next = items[index + 1];
          const connectorSolid = gate.kind === 'done' && next?.gate.kind !== 'locked';
          const displayStatus = gateDisplayStatus(status, gate);

          const rowInner = (
            <div
              className={cn(
                'relative flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors',
                selected && gate.canOpen && 'bg-primary-light/50',
                gate.kind === 'locked' && 'opacity-70',
                gate.canOpen && 'hover:bg-raised/60',
                gate.kind === 'active' && 'journey-unlock',
              )}
            >
              {index < items.length - 1 && (
                <span
                  className={cn(
                    'absolute left-[1.125rem] top-9 bottom-[-0.35rem] w-px',
                    connectorSolid ? 'bg-success' : 'border-l border-dashed border-border',
                  )}
                  aria-hidden
                />
              )}
              <div className="relative z-[1] shrink-0">
                <JourneyNode kind={gate.kind} stepNumber={stepNumber} selected={selected} size="sm" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start gap-2">
                  <span className="mt-px font-mono text-[10px] text-text-tertiary tabular-nums">
                    {stepNumber}.
                  </span>
                  <p
                    className={cn(
                      'text-[13px] font-medium leading-snug',
                      gate.kind === 'locked' ? 'text-muted-foreground' : 'text-foreground',
                      selected && 'text-foreground',
                      gate.kind === 'active' && 'text-primary',
                    )}
                  >
                    {item.title}
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-5">
                  <ResponsibleRoleBadge role={item.responsibleRole} />
                  {gate.kind !== 'locked' && (
                    <StatusBadgeWithTimeline status={displayStatus} item={item} />
                  )}
                </div>
                {gate.kind === 'waiting' && gate.message && (
                  <p className="mt-1 pl-5 text-[11px] text-muted-foreground">{gate.message}</p>
                )}
              </div>
            </div>
          );

          if (!gate.canOpen) {
            return (
              <li key={item.id}>
                <ChecklistLockedHint message={gate.message ?? lockedFallback}>
                  <button type="button" className="w-full">
                    {rowInner}
                  </button>
                </ChecklistLockedHint>
              </li>
            );
          }

          return (
            <li key={item.id}>
              <button type="button" className="w-full" onClick={() => onSelect(item.id)}>
                {rowInner}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const lockedFallback = 'This opens after the previous step is complete.';
