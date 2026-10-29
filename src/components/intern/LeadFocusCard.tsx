'use client';

import { useRef, useState } from 'react';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Tag } from '@/components/ui/spectrum-chip';
import { EmptyState } from '@/components/ui/empty-state';
import { toastUndo } from '@/components/ui/undo-toast';
import { toastSuccess } from '@/lib/toast-errors';
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
  type InternFocusEntry,
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

/** The to-do state the card reads and writes (`useOwnFocusTodos`). A parent that also adds to-dos passes it in. */
export type FocusTodos = ReturnType<typeof useOwnFocusTodos>;

type Show = 'open' | 'done' | 'all';

/**
 * The lead's to-dos (prototype `TodoCard` in the Inbox): Open, Done and All tabs; each row has
 * a checkbox, the text (struck through when done), the client and kind for a pinned work item
 * with a "Pinned" tag, and a remove button that offers Undo. The form sits at the bottom:
 * "New to-do", "From queue" (pin a work item) and Add. With `todos` the parent shares its state.
 */
export function LeadFocusCard({
  userId,
  items,
  embedded = false,
  todos,
}: {
  userId: string;
  items: InternWorkItem[];
  /** Render only the body, for the "My to-dos" tab of the lead's Inbox card. */
  embedded?: boolean;
  todos?: FocusTodos;
}) {
  const own = useOwnFocusTodos(todos ? '' : userId, items);
  const { focus, persist, byId } = todos ?? own;
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState('');
  const [show, setShow] = useState<Show>('open');
  const draftRef = useRef<HTMLInputElement>(null);
  const pickable = items.filter((i) => i.kind !== 'done' && !focus.some((f) => f.id === i.id));

  const addCustom = () => {
    const title = draft.trim();
    if (!title) return;
    persist([...focus, createCustomInternFocus(title)]);
    setDraft('');
    toastSuccess('To-do added', title);
  };
  const remove = (entry: InternFocusEntry, title: string) => {
    const before = focus;
    persist(focus.filter((row) => row.id !== entry.id));
    toastUndo(`Removed · ${title}`, () => persist(before));
  };
  const toggle = (entry: InternFocusEntry) =>
    persist(focus.map((row) => (row.id === entry.id ? { ...row, done: !row.done } : row)));

  const checkboxClass = (done: boolean) =>
    cn(
      'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-sm border border-line-strong transition-colors',
      done && 'border-brand bg-brand text-on-brand',
    );
  const removeClass =
    'grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-faint transition-colors hover:bg-hover hover:text-ink';

  const openCount = focus.filter((f) => !f.done).length;
  const doneCount = focus.length - openCount;
  const shown = focus.filter((f) => (show === 'all' ? true : show === 'done' ? f.done : !f.done));

  const tabs = (
    <SpectrumTabs
      label="To-do filter"
      items={[
        { key: 'open', label: 'Open', count: openCount },
        { key: 'done', label: 'Done', count: doneCount },
        { key: 'all', label: 'All' },
      ]}
      value={show}
      onChange={(k) => setShow(k as Show)}
    />
  );

  const form = (
    <form
      className="mt-3 flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        addCustom();
      }}
    >
      <input
        ref={draftRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="New to-do"
        aria-label="New to-do"
        autoComplete="off"
        maxLength={200}
        className="h-control-md min-w-0 flex-1 rounded-md border border-line-strong bg-surface-raised px-2.5 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-brand focus-visible:ring-2 focus-visible:ring-focus-ring"
      />
      {items.length > 0 ? (
        <QueuePinPopover
          open={picking}
          onOpenChange={setPicking}
          pickable={pickable}
          onPin={(item) => persist([...focus, { id: item.id, done: false, title: item.title }])}
        />
      ) : null}
      <button
        type="submit"
        disabled={!draft.trim()}
        className="inline-flex h-control-md shrink-0 items-center rounded-md bg-brand px-3 text-[13px] font-semibold text-on-brand transition-colors hover:bg-brand-strong disabled:opacity-45"
      >
        Add
      </button>
    </form>
  );

  const body = (
    <>
      {shown.length === 0 ? (
        <EmptyState title={show === 'done' ? 'Nothing done yet' : 'No to-dos'} className="min-h-[3.25rem] py-3" />
      ) : (
        <div className="max-h-[min(20rem,46vh)] overflow-y-auto">
          {shown.map((entry) => {
            const item = byId.get(entry.id);
            if (!item && !isCustomInternFocus(entry) && !entry.title?.trim()) return null;
            const title = item?.title ?? (entry.title?.trim() || 'Untitled');
            return (
              <div key={entry.id} className="group flex min-h-[2.75rem] items-start gap-2.5 border-t border-line-soft py-2.5 first:border-0">
                <button
                  type="button"
                  onClick={() => toggle(entry)}
                  className={cn('mt-0.5', checkboxClass(entry.done))}
                  aria-label={entry.done ? 'Mark incomplete' : 'Mark done'}
                >
                  {entry.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </button>
                {item ? (
                  <Link href={item.href} className="min-w-0 flex-1 overflow-hidden">
                    <span className={cn('block line-clamp-2 text-[13px] font-medium leading-snug text-ink', entry.done && 'text-ink-muted line-through')}>
                      {title}
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
                      <Tag tone="idle">Pinned</Tag>
                    </span>
                  </Link>
                ) : (
                  <span className={cn('min-w-0 flex-1 truncate pt-px text-[13px] font-medium text-ink', entry.done && 'text-ink-muted line-through')}>
                    {title}
                  </span>
                )}
                {entry.done && !item ? <Tag tone="ok">Done</Tag> : null}
                <button type="button" onClick={() => remove(entry, title)} className={removeClass} aria-label="Remove from to-dos">
                  <X className="h-3 w-3" strokeWidth={2.2} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {form}
    </>
  );

  if (embedded) {
    return (
      <div className="px-4 pb-3 pt-3">
        <div className="mb-2">{tabs}</div>
        {body}
      </div>
    );
  }

  return (
    <DashSection icon={ListChecks} title="To-dos" meta={openCount} right={tabs} className="h-fit">
      {body}
    </DashSection>
  );
}
