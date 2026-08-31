'use client';

import { useEffect } from 'react';
import { m } from 'framer-motion';
import type { ChecklistItem, StatusCode } from '@/data/checklist';
import { ChecklistLockedHint } from '@/components/incorporation/ChecklistJourneyRail';
import { JourneyNode } from '@/components/incorporation/JourneyNode';
import type { ChecklistStepGate } from '@/lib/checklist-step-gate';
import { phaseClasses } from '@/lib/phase-colors';
import { cn } from '@/lib/utils';

export interface ChecklistFlowItem {
  item: ChecklistItem;
  gate: ChecklistStepGate;
  status: StatusCode;
  stepNumber: number;
  phaseId: string;
  phaseTitle: string;
}

type FlowGroup = {
  id: string;
  title: string;
  items: ChecklistFlowItem[];
};

type ChecklistClientFlowProps = {
  items: ChecklistFlowItem[];
  selectedId: string | null;
  onSelect: (itemId: string) => void;
  variant?: 'compact' | 'rail';
  className?: string;
};

function groupByPhase(items: ChecklistFlowItem[]): FlowGroup[] {
  const groups: FlowGroup[] = [];
  for (const row of items) {
    const last = groups[groups.length - 1];
    if (last && last.id === row.phaseId) {
      last.items.push(row);
    } else {
      groups.push({ id: row.phaseId, title: row.phaseTitle, items: [row] });
    }
  }
  return groups;
}

function phaseKind(items: ChecklistFlowItem[]): ChecklistStepGate['kind'] {
  if (items.length > 0 && items.every((row) => row.gate.kind === 'done')) return 'done';
  if (items.some((row) => row.gate.kind === 'active')) return 'active';
  if (items.some((row) => row.gate.kind === 'waiting')) return 'waiting';
  return 'locked';
}

function statusCopy(gate: ChecklistStepGate): string {
  if (gate.kind === 'done') return 'Ready';
  if (gate.kind === 'active') return 'In progress';
  if (gate.kind === 'waiting') return gate.message ?? 'Waiting';
  // Not "Locked": the gate is unchanged, but a step that has not come round yet
  // reads as upcoming. `gate.message` still says what it opens after.
  return 'Upcoming';
}

function compactPhaseLabel(phaseId: string, title: string): string {
  switch (phaseId) {
    case 'pre-inc-phase-1':
      return 'Name';
    case 'pre-inc-phase-2':
      return 'Details';
    case 'post-inc-phase-3':
      return 'Post-inc';
    case 'registration-phase-4':
      return 'Registration';
    default:
      return title;
  }
}

function pickOpenStep(group: FlowGroup): ChecklistFlowItem | undefined {
  return (
    group.items.find((row) => row.gate.kind === 'active' || row.gate.kind === 'waiting') ??
    [...group.items].reverse().find((row) => row.gate.canOpen)
  );
}

export function checklistPhaseRailLabel(phaseId: string, fallback: string): string {
  switch (phaseId) {
    case 'pre-inc-phase-1':
      return 'Name application';
    case 'pre-inc-phase-2':
      return 'Incorporation details';
    case 'post-inc-phase-3':
      return 'Post-incorporation';
    case 'registration-phase-4':
      return 'Registration';
    default:
      return fallback;
  }
}

/** Create-project flowchart language, adapted to gated checklist steps. */
export function ChecklistClientFlow({
  items,
  selectedId,
  onSelect,
  variant = 'rail',
  className,
}: ChecklistClientFlowProps) {
  const groups = groupByPhase(items);
  const readyCount = items.filter((row) => row.gate.kind === 'done').length;

  useEffect(() => {
    if (!selectedId) return;
    document
      .getElementById(`flow-node-${selectedId}`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedId]);

  if (variant === 'compact') {
    return (
      <nav
        aria-label="Incorporation progress"
        className={cn(
          'rounded-xl border border-border/80 bg-gradient-to-b from-muted/35 to-background p-3',
          className,
        )}
      >
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <p className="text-[11px] mono uppercase tracking-[0.16em] text-muted-foreground">
            Progress
          </p>
          <p className="text-[11px] text-muted-foreground">
            {readyCount} of {items.length}
          </p>
        </div>
        <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {groups.map((group) => {
            const kind = phaseKind(group.items);
            const open = pickOpenStep(group);
            const active = group.items.some((row) => row.item.id === selectedId);
            const done = kind === 'done';
            const phase = phaseClasses(group.id);
            const button = (
              <button
                type="button"
                onClick={() => {
                  if (open) onSelect(open.item.id);
                }}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex w-full flex-col items-center gap-1.5 rounded-lg border px-1.5 py-2.5 text-center transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active && 'border-primary/50 bg-primary-light/80',
                  !active && done && 'border-success/40 bg-success-light/45',
                  !active && kind === 'waiting' && 'border-border/80 bg-panel',
                  !active && !done && kind !== 'waiting' && cn(phase.soft, phase.border, 'hover:brightness-[0.99]'),
                )}
              >
                <JourneyNode kind={kind} stepNumber={group.items[0]?.stepNumber} size="sm" selected={active} />
                <span
                  className={cn(
                    'text-[10.5px] font-medium leading-tight',
                    active ? 'text-primary' : done ? 'text-success-text' : phase.label,
                  )}
                >
                  {compactPhaseLabel(group.id, group.title)}
                </span>
              </button>
            );

            return (
              <li key={group.id} className="min-w-0">
                {open ? (
                  button
                ) : (
                  <ChecklistLockedHint
                    message={group.items[0]?.gate.message ?? 'This opens after the previous step is complete.'}
                  >
                    {button}
                  </ChecklistLockedHint>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  const flat = items;

  return (
    <aside
      aria-label="Incorporation progress"
      className={cn(
        'flex h-full min-h-0 flex-col rounded-2xl border border-border/70',
        'bg-gradient-to-b from-background via-background to-primary-light/40',
        'px-3.5 py-4 shadow-[0_10px_40px_-24px_oklch(var(--shadow-ink)/0.35)]',
        className,
      )}
    >
      <div className="mb-4 shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          Progress
        </p>
        <p className="mt-2 text-[15px] font-semibold tabular-nums tracking-tight text-foreground">
          <m.span
            key={readyCount}
            initial={{ opacity: 0.35, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="inline-block"
          >
            {readyCount}
          </m.span>
          <span className="font-medium text-muted-foreground"> / {items.length}</span>
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary-light ring-1 ring-primary/20">
          <m.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary-dark"
            initial={false}
            animate={{ width: `${items.length ? (readyCount / items.length) * 100 : 0}%` }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          />
        </div>
      </div>

      <ol className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-0.5">
        {flat.map((row, i) => {
          const { item, gate, stepNumber } = row;
          const done = gate.kind === 'done';
          const waiting = gate.kind === 'waiting';
          const locked = gate.kind === 'locked';
          const isLast = i === flat.length - 1;
          const showPhase = i === 0 || row.phaseId !== flat[i - 1]?.phaseId;
          const selected = item.id === selectedId;
          const phase = phaseClasses(row.phaseId, item.bucket);

          const connector = !isLast ? (
            <span
              aria-hidden
              className="relative mt-1 w-[2px] min-h-[1.25rem] flex-1 overflow-hidden rounded-full bg-border/80"
            >
              <m.span
                className="absolute inset-x-0 top-0 w-full origin-top rounded-full bg-success"
                initial={false}
                animate={{ scaleY: done ? 1 : 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                style={{ height: '100%' }}
              />
            </span>
          ) : null;

          const card = (
            <m.span
              layout
              initial={false}
              className={cn(
                'mb-1 flex min-w-0 flex-1 flex-col items-start justify-start rounded-xl border px-2.5 py-1.5 text-left transition-colors duration-200',
                isLast && 'mb-0',
                selected && 'border-primary/55 bg-primary-light/80 border-[1.5px]',
                !selected && done && 'border-success/35 bg-success-light/40',
                !selected && waiting && 'border-border/70 bg-transparent',
                !selected && locked && 'border-transparent bg-transparent',
                !selected && !done && !waiting && !locked && 'border-transparent bg-transparent',
              )}
            >
              <span
                className={cn(
                  'line-clamp-2 text-[13px] font-semibold tracking-tight transition-colors duration-200',
                  selected && 'text-foreground',
                  done && !selected && 'text-success-text',
                  waiting && !selected && 'text-muted-foreground',
                  locked && 'text-foreground/55',
                  !done && !waiting && !locked && !selected && 'text-foreground/80',
                )}
              >
                {item.title}
              </span>
              <m.span
                key={`${item.id}-${gate.kind}-${selected ? 'sel' : 'idle'}`}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className={cn(
                  'mt-0.5 text-[11px] font-medium leading-snug',
                  done && 'text-success-text',
                  (gate.kind === 'active' || selected) && !done && !waiting && 'text-primary',
                  waiting && 'text-muted-foreground',
                  locked && 'text-foreground/45',
                )}
              >
                {statusCopy(gate)}
              </m.span>
            </m.span>
          );

          const rowInner = (
            <span className="relative flex min-h-0 w-full gap-3">
              <span className="flex w-8 shrink-0 flex-col items-center">
                <JourneyNode kind={gate.kind} stepNumber={stepNumber} selected={selected} />
                {connector}
              </span>
              {card}
            </span>
          );

          return (
            <li key={item.id} className="flex flex-col">
              {showPhase ? (
                <p
                  className={cn(
                    'mb-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]',
                    phase.soft,
                    phase.label,
                    i === 0 ? 'mt-0' : 'mt-3',
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-current opacity-80"
                    aria-hidden
                  />
                  {row.phaseTitle}
                </p>
              ) : null}
              {locked ? (
                <ChecklistLockedHint message={gate.message ?? 'This opens after the previous step is complete.'}>
                  <button
                    type="button"
                    id={`flow-node-${item.id}`}
                    className="w-full cursor-default rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    {rowInner}
                  </button>
                </ChecklistLockedHint>
              ) : (
                <m.button
                  type="button"
                  id={`flow-node-${item.id}`}
                  onClick={() => onSelect(item.id)}
                  aria-current={selected ? 'step' : undefined}
                  initial={gate.kind === 'active' ? { scale: 0.98 } : { scale: 1 }}
                  animate={{ scale: 1 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  className={cn(
                    'w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                    gate.kind === 'active' && 'journey-unlock',
                  )}
                >
                  {rowInner}
                </m.button>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
