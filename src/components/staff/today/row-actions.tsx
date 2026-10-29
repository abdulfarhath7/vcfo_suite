'use client';

import type { ReactNode } from 'react';
import { ArrowUpRight, BellRing, UserRoundPlus, type LucideIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BULK_BUTTON } from '@/components/ui/bulk-bar';
import { Tip } from '@/components/ui/tip';
import { cn } from '@/lib/utils';

/* Small parts for the staff tables' row quick actions (E-02) and the bulk bar's Assign (E-01). */

/** A ghost 28px icon button at the row end, with its name and key in a dark tip. */
export function RowIconButton({
  label,
  shortcut,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  shortcut?: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tip label={label} keys={shortcut ? [shortcut] : undefined} side="top">
      <button
        type="button"
        data-grid-ctl
        tabIndex={-1}
        aria-label={label}
        aria-keyshortcuts={shortcut}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="grid h-7 w-7 place-items-center rounded-md text-ink-muted hover:bg-ink/[.06] hover:text-ink disabled:pointer-events-none disabled:opacity-40"
      >
        <Icon className="h-[15px] w-[15px]" strokeWidth={1.6} aria-hidden />
      </button>
    </Tip>
  );
}

/** Open, Remind and Reassign at a row end. Leave a handler out to hide its button. */
export function RowQuickActions({
  onOpen,
  onRemind,
  onReassign,
  children,
}: {
  onOpen?: () => void;
  onRemind?: () => void;
  onReassign?: () => void;
  children?: ReactNode;
}) {
  return (
    <>
      {onOpen ? <RowIconButton label="Open" shortcut="Enter" icon={ArrowUpRight} onClick={onOpen} /> : null}
      {onRemind ? <RowIconButton label="Remind" shortcut="R" icon={BellRing} onClick={onRemind} /> : null}
      {onReassign ? <RowIconButton label="Reassign" shortcut="A" icon={UserRoundPlus} onClick={onReassign} /> : null}
      {children}
    </>
  );
}

/** The bulk bar's Assign: a menu of the people the picked rows can go to. */
export function BulkAssignMenu({
  people,
  count,
  onPick,
  disabled,
}: {
  people: Array<{ id: string; name: string }>;
  count: number;
  onPick: (person: { id: string; name: string }) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" className={BULK_BUTTON} disabled={disabled || people.length === 0} aria-label={`Assign ${count} selected`}>
          <UserRoundPlus className="h-[15px] w-[15px]" strokeWidth={1.6} aria-hidden />
          <span className="max-sm:sr-only" aria-hidden>
            Assign
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={12} className={cn('max-h-[320px] w-[220px] overflow-y-auto normal-case tracking-normal')}>
        <DropdownMenuLabel className="pb-1 text-[12px] font-medium text-ink-muted">Assign to</DropdownMenuLabel>
        {people.map((p) => (
          <DropdownMenuItem key={p.id} onSelect={() => onPick(p)} className="flex h-[34px] items-center">
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
