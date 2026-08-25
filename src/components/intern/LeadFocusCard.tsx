'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Plus, X } from 'lucide-react';
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
} from '@/lib/intern-work';
import { useOwnFocusTodos } from '@/lib/use-personal-todos';
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
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-primary ring-1 ring-primary/20 transition-colors hover:bg-primary-light',
            open && 'bg-primary-light',
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
        className="w-[min(22rem,calc(100vw-2rem))] p-0 shadow-lg"
      >
        {pickable.length === 0 ? (
          <p className="px-3 py-4 text-[13px] leading-snug text-muted-foreground">
            Nothing left to pin from the queue.
          </p>
        ) : (
          <Command className="rounded-md bg-transparent" loop>
            <CommandInput placeholder="Filter queue…" className="h-9 text-[13px]" />
            <CommandList className="max-h-64">
              <CommandEmpty className="py-4 text-center text-[13px] text-muted-foreground">
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
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
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

  return (
    <section className="surface h-fit min-w-0 overflow-hidden">
      <div className="flex min-w-0 items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <h2 className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink">Todos</h2>
        </div>
        {items.length > 0 ? (
          <QueuePinPopover
            open={picking}
            onOpenChange={setPicking}
            pickable={pickable}
            onPin={(item) => persist([...focus, { id: item.id, done: false, title: item.title }])}
          />
        ) : null}
      </div>

      <form
        className="px-4 pb-1 pt-2.5"
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
            placeholder="Type a todo…"
            aria-label="New todo"
            autoComplete="off"
            maxLength={200}
            className="h-8 min-w-0 flex-1 rounded-lg bg-raised/70 px-2.5 text-[13px] text-ink outline-none ring-1 ring-border/80 placeholder:text-muted-foreground/80 focus:bg-panel focus:ring-primary/35"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="inline-flex h-8 shrink-0 items-center rounded-lg bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground transition-opacity disabled:opacity-35"
          >
            Add
          </button>
        </div>
      </form>

      {focus.length === 0 ? (
        <div className="px-4 pb-3 pt-2">
          <button
            type="button"
            onClick={() => draftRef.current?.focus()}
            className="flex min-h-[3.25rem] w-full flex-col items-start justify-center rounded-xl border border-dashed border-border/80 px-3 py-2 text-left transition-colors hover:border-primary/35 hover:bg-primary-light/40"
          >
            <span className="text-[13px] font-semibold text-ink">Type a todo</span>
            {items.length > 0 ? (
              <span className="mt-0.5 text-[12px] text-muted-foreground">
                Add what you need to get done — or pin work from the queue.
              </span>
            ) : null}
          </button>
        </div>
      ) : null}

      {focus.length > 0 ? (
        <div className="max-h-[min(20rem,46vh)] space-y-2 overflow-y-auto px-4 pb-3 pt-2.5">
          {focus.map((entry) => {
            const item = byId.get(entry.id);
            if (item) {
              return (
                <div
                  key={entry.id}
                  className="group flex min-h-[3.5rem] items-start gap-2.5 rounded-xl bg-raised/60 px-3 py-2.5 ring-1 ring-border/70"
                >
                  <button
                    type="button"
                    onClick={() =>
                      persist(focus.map((row) => (row.id === entry.id ? { ...row, done: !row.done } : row)))
                    }
                    className={cn(
                      'mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-border transition-colors',
                      entry.done && 'border-primary bg-primary text-primary-foreground',
                    )}
                    aria-label={entry.done ? 'Mark incomplete' : 'Mark done'}
                  >
                    {entry.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </button>
                  <Link href={item.href} className="min-w-0 flex-1 overflow-hidden">
                    <span className={cn('block line-clamp-2 text-[13px] font-semibold leading-snug text-ink', entry.done && 'text-muted-foreground line-through')}>
                      {item.title}
                    </span>
                    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 truncate text-[11px] text-muted-foreground">{item.companyName}</span>
                      <span
                        className={cn(
                          'inline-flex max-w-full shrink-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                          internToneBadge(KIND_TONE[entry.done ? 'done' : item.kind] ?? 'info'),
                        )}
                      >
                        {entry.done ? 'done' : internKindChipLabel(item.kind)}
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => persist(focus.filter((row) => row.id !== entry.id))}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
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
                className="group flex min-h-[2.75rem] items-center gap-2.5 rounded-xl bg-raised/60 px-3 py-2 ring-1 ring-border/70"
              >
                <button
                  type="button"
                  onClick={() =>
                    persist(focus.map((row) => (row.id === entry.id ? { ...row, done: !row.done } : row)))
                  }
                  className={cn(
                    'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-border transition-colors',
                    entry.done && 'border-primary bg-primary text-primary-foreground',
                  )}
                  aria-label={entry.done ? 'Mark incomplete' : 'Mark done'}
                >
                  {entry.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </button>
                <span className={cn('min-w-0 flex-1 truncate text-[13px] font-semibold text-ink', entry.done && 'text-muted-foreground line-through')}>
                  {entry.title?.trim() || 'Untitled'}
                </span>
                <button
                  type="button"
                  onClick={() => persist(focus.filter((row) => row.id !== entry.id))}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Remove from todos"
                >
                  <X className="h-3 w-3" strokeWidth={2.2} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
