'use client';

import type { ChecklistItem } from '@/data/checklist';
import type { StatusCode } from '@/data/checklist';
import { ChecklistStatusBadge } from '@/components/incorporation/ChecklistStatusBadge';
import { JourneyNode } from '@/components/incorporation/JourneyNode';
import { ResponsibleRoleBadge } from '@/components/incorporation/ResponsibleRoleBadge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { StepAttachmentRequirement } from '@/lib/checklist-step-attachments';
import type { ChecklistStepGate } from '@/lib/checklist-step-gate';
import { gateDisplayStatus } from '@/lib/checklist-step-gate';
import { toastInfo } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Clock, MoreVertical } from 'lucide-react';
import { LayoutGroup, useReducedMotion } from 'framer-motion';
import { MotionActivePill } from '@/components/shell/MotionActivePill';

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
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
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
  attachments?: StepAttachmentRequirement[];
}

interface ChecklistJourneyRailProps {
  items: JourneyRailItem[];
  selectedId: string | null;
  onSelect: (itemId: string) => void;
  /** Intern/lead: every row opens; no lock glyphs, muted rows, or “opens after”. */
  allowLockedOpen?: boolean;
  /** Intern/lead: no expected-timeline / working-days SLA. */
  /** Intern/lead: no StatusBadge / StatusPill (Completed, In progress, etc.). */
  hideStatus?: boolean;
  /** Kebab → Attachments required (intern step rail). */
  showAttachmentMenu?: boolean;
  className?: string;
}

function JourneyRailAttachmentMenu({ attachments }: { attachments: StepAttachmentRequirement[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-raised hover:text-foreground"
          aria-label="Step actions"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MoreVertical className="h-3.5 w-3.5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Attachments required</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64 p-1.5">
            {attachments.length === 0 ? (
              <p className="px-1.5 py-1 text-[12px] text-muted-foreground">None</p>
            ) : (
              <ul className="space-y-1">
                {attachments.map((file) => (
                  <li key={file.fieldId} className="flex items-start gap-2 px-1.5 py-1 text-[12px]">
                    {file.uploaded ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                    ) : (
                      <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <span className="min-w-0 leading-snug">
                      <span className="block text-foreground">{file.label}</span>
                      {file.uploaded && file.fileName ? (
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {file.fileName}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Sticky vertical stepper: solid connector through done, dashed through locked. */
export function ChecklistJourneyRail({
  items,
  selectedId,
  onSelect,
  allowLockedOpen = false,
  hideStatus = false,
  showAttachmentMenu = false,
  className,
}: ChecklistJourneyRailProps) {
  const reduceMotion = useReducedMotion();
  const animateSelected = allowLockedOpen;

  return (
    <nav aria-label="Checklist steps" className={cn('relative', className)}>
      <LayoutGroup id="intern-journey-rail">
      <ol className="list-none space-y-0">
        {items.map((row, index) => {
          const { item, gate, status, stepNumber, attachments = [] } = row;
          const selected = selectedId === item.id;
          const next = items[index + 1];
          const isLast = index === items.length - 1;
          const connectorSolid = gate.kind === 'done' && next?.gate.kind !== 'locked';
          const displayStatus = gateDisplayStatus(status, gate);
          const visuallyLocked = gate.kind === 'locked' && !allowLockedOpen;
          const canSelect = allowLockedOpen || gate.canOpen;

          const compactConnector = !isLast && (
            <span
              className={cn(
                'absolute left-[1.125rem] top-9 bottom-[-0.35rem] w-px',
                connectorSolid ? 'bg-success' : 'border-l border-dashed border-border',
              )}
              aria-hidden
            />
          );

          const node = (
            <JourneyNode
              kind={gate.kind}
              stepNumber={stepNumber}
              selected={selected}
              size="sm"
            />
          );

          const labelBlock = (
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-start gap-1.5">
                <p
                  className={cn(
                    'min-w-0 text-[13px] font-medium leading-snug',
                    visuallyLocked ? 'text-muted-foreground' : 'text-foreground',
                    selected && 'text-foreground',
                    gate.kind === 'active' && 'text-primary',
                  )}
                >
                  {item.title}
                </p>
                <ResponsibleRoleBadge role={item.responsibleRole} iconOnly className="mt-0.5" />
              </div>
              {!visuallyLocked && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 empty:hidden">
                  <ChecklistStatusBadge
                    status={displayStatus}
                    hideStatus={hideStatus}
                  />
                </div>
              )}
              {gate.kind === 'waiting' && gate.message && (
                <p className="mt-1 text-[11px] text-muted-foreground">{gate.message}</p>
              )}
            </div>
          );

          const rowShell = cn(
            'relative flex w-full items-start text-left transition-colors',
            'gap-2 rounded-lg py-2.5 pl-2 pr-1',
            selected && canSelect && !animateSelected && 'bg-primary-light/50',
            visuallyLocked && 'opacity-70',
            canSelect && 'hover:bg-raised/60',
            gate.kind === 'active' && 'journey-unlock',
          );

          const selectedPill =
            animateSelected && selected ? (
              <MotionActivePill
                layoutId="intern-journey-selected"
                reduced={reduceMotion}
                className="absolute inset-0 rounded-lg bg-primary-light/50"
              />
            ) : null;

          const attachmentSlot = showAttachmentMenu ? (
            <div className="relative z-[2] shrink-0">
              <JourneyRailAttachmentMenu attachments={attachments} />
            </div>
          ) : null;

          const stepCopy = (
            <>
              <div className="relative z-[1] shrink-0">{node}</div>
              {labelBlock}
            </>
          );

          if (!canSelect) {
            return (
              <li key={item.id}>
                <ChecklistLockedHint message={gate.message ?? lockedFallback}>
                  <button type="button" className={cn(rowShell, 'gap-3')}>
                    {compactConnector}
                    {stepCopy}
                  </button>
                </ChecklistLockedHint>
              </li>
            );
          }

          return (
            <li key={item.id}>
              <div className={rowShell}>
                {selectedPill}
                {compactConnector}
                <button
                  type="button"
                  className="relative z-[1] flex min-w-0 flex-1 items-start gap-3 text-left"
                  onClick={() => onSelect(item.id)}
                >
                  {stepCopy}
                </button>
                {attachmentSlot}
              </div>
            </li>
          );
        })}
      </ol>
      </LayoutGroup>
    </nav>
  );
}

const lockedFallback = 'This opens after the previous step is complete.';
