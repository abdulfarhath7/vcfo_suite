'use client';

import * as React from 'react';
import * as M from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight, MoreHorizontal, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Kbd } from '@/components/ui/kbd';
import { UserFace } from '@/components/common/UserFace';
import { initialsOf } from '@/components/ui/avatar-stack';

/**
 * The row menu (VCFO Spectrum D1 and D2, prototype ActionMenu): a 30px kebab square, a menu at
 * least 200px wide with a 5px inset, 34px rows, 16px icons and letter keys as key caps. Pressing a
 * letter while the menu is open runs that item. An item with `people` opens a side menu of people
 * (220px, 24px faces, a tick on the current one), as Reassign has.
 */
export type ActionItem =
  | {
      label: string;
      onSelect?: () => void;
      /** A small grey note at the right: "12 files". */
      hint?: string;
      /** A one-letter shortcut (E Edit, A Reassign, C Copy link). */
      key?: string;
      danger?: boolean;
      Icon?: LucideIcon;
      disabled?: boolean;
      /** A side menu of people. */
      people?: { label?: string; names: string[]; current?: string; onPick: (name: string) => void };
    }
  | 'separator';

const ROW =
  'flex h-[34px] cursor-pointer select-none items-center gap-2.5 rounded-mark px-[9px] outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-hover data-[state=open]:bg-hover';

export function ActionMenu({
  items,
  label,
  className,
  align = 'end',
  trigger,
}: {
  items: ActionItem[];
  /** The kebab's accessible name: "More actions for Acme". */
  label: string;
  className?: string;
  align?: 'start' | 'end';
  /** Replaces the kebab button; it must forward a ref (like Button). */
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = React.useState(false);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    const hit = items.find((it) => it !== 'separator' && !it.disabled && it.key && it.key.toLowerCase() === e.key.toLowerCase());
    if (!hit || hit === 'separator') return;
    e.preventDefault();
    e.stopPropagation();
    if (hit.people) {
      const el = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-menu-key="${hit.key}"]`);
      el?.focus();
      el?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      return;
    }
    setOpen(false);
    hit.onSelect?.();
  };
  return (
    <M.Root modal={false} open={open} onOpenChange={setOpen}>
      <M.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'grid h-[30px] w-[30px] flex-none place-items-center rounded-md text-ink-muted hover:bg-ink/[.06] hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25 data-[state=open]:bg-ink/[.06] data-[state=open]:text-ink',
              className,
            )}
          >
            <MoreHorizontal size={16} strokeWidth={1.6} aria-hidden />
          </button>
        )}
      </M.Trigger>
      <M.Portal>
        <M.Content
          align={align}
          sideOffset={4}
          collisionPadding={12}
          aria-label={label}
          onKeyDown={onKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="z-50 min-w-[200px] overflow-hidden rounded-md border-1.5 border-line bg-surface-raised p-[5px] text-[14px] text-ink shadow-float"
        >
          {items.map((it, i) => {
            if (it === 'separator') return <M.Separator key={`s${i}`} className="my-1 h-[1.5px] bg-line-soft" />;
            const body = (
              <>
                {it.Icon ? <it.Icon size={16} strokeWidth={1.6} className={cn('flex-none', it.danger ? 'text-danger' : 'text-ink-muted')} aria-hidden /> : null}
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                {it.hint ? <span className="flex-none text-[12px] text-ink-muted">{it.hint}</span> : null}
                {it.key ? <Kbd>{it.key.toUpperCase()}</Kbd> : null}
              </>
            );
            if (it.people) {
              const pp = it.people;
              return (
                <M.Sub key={it.label}>
                  <M.SubTrigger data-menu-key={it.key} aria-keyshortcuts={it.key?.toUpperCase()} disabled={it.disabled} className={ROW}>
                    {body}
                    {!it.key ? <ChevronRight size={14} strokeWidth={1.6} className="flex-none text-ink-muted" aria-hidden /> : null}
                  </M.SubTrigger>
                  <M.Portal>
                    <M.SubContent
                      sideOffset={8}
                      collisionPadding={12}
                      onClick={(e) => e.stopPropagation()}
                      className="z-50 max-h-[60vh] w-[220px] overflow-y-auto rounded-md border-1.5 border-line bg-surface-raised p-[5px] text-[14px] text-ink shadow-float"
                    >
                      <M.Label className="px-[9px] pb-1 pt-1.5 text-[12px] font-medium text-ink-muted">{pp.label ?? 'Assign to'}</M.Label>
                      {pp.names.map((n) => (
                        <M.Item key={n} onSelect={() => pp.onPick(n)} className={ROW}>
                          <UserFace initials={initialsOf(n)} toneFrom={n} className="h-6 w-6 text-[10px] font-medium" />
                          <span className="min-w-0 flex-1 truncate">{n}</span>
                          {n === pp.current ? <Check size={14} strokeWidth={1.6} className="flex-none text-brand" aria-label="Current" /> : null}
                        </M.Item>
                      ))}
                    </M.SubContent>
                  </M.Portal>
                </M.Sub>
              );
            }
            return (
              <M.Item
                key={it.label}
                disabled={it.disabled}
                onSelect={() => it.onSelect?.()}
                aria-keyshortcuts={it.key?.toUpperCase()}
                className={cn(ROW, it.danger && 'text-danger')}
              >
                {body}
              </M.Item>
            );
          })}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}
