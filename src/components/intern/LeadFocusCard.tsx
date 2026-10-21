'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ListChecks, Plus, X } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { CHIP_CLASS } from '@/components/common/IconChip';
import { internKindChipLabel, internToneBadge, KIND_TONE } from '@/components/intern/intern-tones';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  createCustomInternFocus,
  isCustomInternFocus,
  type InternWorkItem,
} from '@/lib/intern/intern-work';
import { useOwnFocusTodos } from '@/hooks/use-personal-todos';
import { cn } from '@/lib/utils';

function QueuePinPopover({
  open,
  onOpenChange,
  pickable,
  onPin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickable: InternWorkItem[];
  onPin: (item: InternWorkItem) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Pin from queue"
          className={cn(
            'inline-flex h-control-sm shrink-0 items-center gap-1 rounded-md border border-line-strong bg-surface-raised px-2.5 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-sunken',
            open && 'bg-surface-sunken',
          )}
        >
          <Plus className="h-3 w-3" strokeWidth={2.4} />
          From queue
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        collisionPadding={16}
        className="w-[min(22rem,calc(100vw-2rem))] p-0 shadow-float"
      >
        {pickable.length === 0 ? (
          <p className="px-3 py-4 text-[13px] leading-snug text-ink-muted">
            Nothing left to pin from the queue.
          </p>
        ) : (
          <Command className="rounded-md bg-transparent" loop>
            <CommandInput placeholder="Filter queue…" className="h-9 text-[13px]" />
            <CommandList className="max-h-64">
              <CommandEmpty className="py-4 text-center text-[13px] text-ink-muted">
                No matching work items.
              </CommandEmpty>
              <CommandGroup className="p-1">
                {pickable.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.title} ${item.companyName} ${item.id}`}
                    onSelect={() => {
                      onPin(item);
                      onOpenChange(false);
                    }}
                    className="items-start gap-2 rounded-md px-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{item.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
                        {item.companyName}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function LeadFocusCard({
  userId,
  items,
}: {
  userId: string;
  items: InternWorkItem[];
}) {
  const { focus, persist, byId } = useOwnFocusTodos(userId, items);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState('');
  const draftRef = useRef<HTMLInputElement>(null);
  const pickable = items.filter((i) => i.kind !== 'done' && !focus.some((f) => f.id === i.id));

  const addCustom = () => {
    const title = draft.trim();
    if (!title) return;
    persist([...focus, createCustomInternFocus(title)]);
    setDraft('');
  };

  const checkboxClass = (done: boolean) =>
    cn(
      'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-sm border border-line-strong transition-colors',
      done && 'border-brand bg-brand text-on-brand',
    );
  const removeClass =
    'grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink';

  return (
    <DashSection
      icon={ListChecks}
      title="Todos"
      className="h-fit"
      bodyClassName="pt-2"
      meta={
        items.length > 0 ? (
          <QueuePinPopover
            open={picking}
            onOpenChange={setPicking}
            pickable={pickable}
            onPin={(item) => persist([...focus, { id: item.id, done: false, title: item.title }])}
          />
        ) : undefined
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addCustom();
        }}
      >
        <div className="flex items-center gap-2">
          <input
            ref={draftRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a todo"
            aria-label="New todo"
            autoComplete="off"
            maxLength={200}
            className="h-control-md min-w-0 flex-1 rounded-md border border-line-strong bg-surface-raised px-2.5 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-brand focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="inline-flex h-control-md shrink-0 items-center rounded-md bg-brand px-3 text-[13px] font-semibold text-on-brand transition-colors hover:bg-brand-strong disabled:opacity-45"
          >
            Add
          </button>
        </div>
      </form>

      {focus.length === 0 ? (
        <button
          type="button"
          onClick={() => draftRef.current?.focus()}
          className="mt-2.5 flex min-h-[3.25rem] w-full flex-col items-start justify-center rounded-md border border-dashed border-line-strong px-3 py-2 text-left transition-colors hover:border-brand hover:bg-brand-soft/50"
        >
          <span className="text-[13px] font-semibold text-ink">Type a todo</span>
          {items.length > 0 ? (
            <span className="mt-0.5 text-[12px] text-ink-muted">
              Add what you need to get done, or pin work from the queue.
            </span>
          ) : null}
        </button>
      ) : null}

      {focus.length > 0 ? (
        <div className="mt-1.5 max-h-[min(20rem,46vh)] overflow-y-auto">
          {focus.map((entry) => {
            const item = byId.get(entry.id);
            if (item) {
              return (
                <div
                  key={entry.id}
                  className="group flex min-h-[3.25rem] items-start gap-2.5 border-t border-line py-2.5 first:border-0"
                >
                  <button
                    type="button"
                    onClick={() =>
                      persist(focus.map((row) => (row.id === entry.id ? { ...row, done: !row.done } : row)))
                    }
                    className={cn('mt-0.5', checkboxClass(entry.done))}
                    aria-label={entry.done ? 'Mark incomplete' : 'Mark done'}
                  >
                    {entry.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </button>
                  <Link href={item.href} className="min-w-0 flex-1 overflow-hidden">
                    <span className={cn('block line-clamp-2 text-[13px] font-medium leading-snug text-ink', entry.done && 'text-ink-muted line-through')}>
                      {item.title}
                    </span>
                    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 truncate text-[11px] text-ink-muted">{item.companyName}</span>
                      <span
                        className={cn(
                          CHIP_CLASS,
                          'max-w-full shrink-0 overflow-hidden text-ellipsis',
                          internToneBadge(KIND_TONE[entry.done ? 'done' : item.kind] ?? 'info'),
                        )}
                      >
                        {entry.done ? 'Done' : internKindChipLabel(item.kind)}
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => persist(focus.filter((row) => row.id !== entry.id))}
                    className={removeClass}
                    aria-label="Remove from todos"
                  >
                    <X className="h-3 w-3" strokeWidth={2.2} />
                  </button>
                </div>
              );
            }

            if (!isCustomInternFocus(entry) && !entry.title?.trim()) return null;

            return (
              <div
                key={entry.id}
                className="group flex min-h-[2.75rem] items-center gap-2.5 border-t border-line py-2 first:border-0"
              >
                <button
                  type="button"
                  onClick={() =>
                    persist(focus.map((row) => (row.id === entry.id ? { ...row, done: !row.done } : row)))
                  }
                  className={checkboxClass(entry.done)}
                  aria-label={entry.done ? 'Mark incomplete' : 'Mark done'}
                >
                  {entry.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </button>
                <span className={cn('min-w-0 flex-1 truncate text-[13px] font-medium text-ink', entry.done && 'text-ink-muted line-through')}>
                  {entry.title?.trim() || 'Untitled'}
                </span>
                <button
                  type="button"
                  onClick={() => persist(focus.filter((row) => row.id !== entry.id))}
                  className={removeClass}
                  aria-label="Remove from todos"
                >
                  <X className="h-3 w-3" strokeWidth={2.2} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </DashSection>
  );
}
