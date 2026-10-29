'use client';

import { useState } from 'react';
import { UserRoundPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { WorkField } from '@/components/work/WorkField';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PersonAvatar } from '@/views/admin/firm-people/parts';
import {
  INTERN_FOCUS_TITLE_MAX,
  createCustomInternFocus,
  isCustomInternFocus,
  type InternFocusEntry,
  type InternWorkItem,
} from '@/lib/intern/intern-work';
import { cn } from '@/lib/utils';

type Person = { id: string; name: string };

/**
 * Hand a to-do to a project lead (manager Work, S-234). Only a pinned work item can move: it
 * moves through `/api/work/reassign`, so the lead sees it in their own Work. A typed to-do has
 * no client, so it stays the manager's.
 */
export interface TodoHandOff {
  leads: Person[];
  /** The lead who holds a pinned item now, if any. */
  ownerOf: (item: InternWorkItem) => Person | undefined;
  /** Whether the item can move on its own (steps and tasks; filings and requests move with the client). */
  canHand: (item: InternWorkItem) => boolean;
  onHand: (item: InternWorkItem, to: Person) => void;
}

/**
 * Planner to-dos card (prototype `TodoCard`): the user's personal to-dos, the same list as
 * the Today to-do card (`useOwnFocusTodos`, `/api/todos`). A typed to-do shows its title;
 * a pinned work item opens the task drawer. The quick-add line at the top adds a typed to-do.
 * With `hand` (manager Work) a pinned row shows its lead and a person-plus menu to hand it on,
 * and the head counts the to-dos with project leads.
 */
export function PlannerTodos({
  focus,
  byId,
  persist,
  onOpenItem,
  onNew,
  hand,
}: {
  focus: InternFocusEntry[];
  byId: Map<string, InternWorkItem>;
  persist: (next: InternFocusEntry[]) => void;
  onOpenItem: (id: string) => void;
  onNew: () => void;
  hand?: TodoHandOff;
}) {
  const [quick, setQuick] = useState('');
  const open = focus.filter((f) => !f.done).length;
  const withLeads = hand
    ? focus.filter((f) => {
        const item = isCustomInternFocus(f) ? undefined : byId.get(f.id);
        return !f.done && item && hand.ownerOf(item);
      }).length
    : 0;
  return (
    <section className="surface min-w-0 overflow-hidden">
      <div className="flex min-h-[52px] items-center gap-2 border-b border-line-soft px-4">
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">To-dos</h2>
        {withLeads > 0 ? (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[12px] font-medium text-brand-text tabular-nums">
            {withLeads} with project leads
          </span>
        ) : null}
        <span className="text-[12.5px] text-ink-muted tabular-nums">{open} open</span>
        <Button size="sm" variant="secondary" onClick={onNew}>
          New to-do
        </Button>
      </div>
      <form
        className="flex items-center gap-2 border-b border-line-soft px-4 py-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          const title = quick.trim();
          if (!title) return;
          persist([createCustomInternFocus(title), ...focus]);
          setQuick('');
        }}
      >
        <Input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder="Add a to-do"
          aria-label="Add a to-do"
          maxLength={INTERN_FOCUS_TITLE_MAX}
          className="h-9"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={!quick.trim()}>
          Add
        </Button>
      </form>
      {focus.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No to-dos" />
        </div>
      ) : (
        <ul>
          {focus.map((entry) => {
            const item = isCustomInternFocus(entry) ? undefined : byId.get(entry.id);
            const title = item?.title ?? entry.title ?? 'To-do';
            const owner = item && hand ? hand.ownerOf(item) : undefined;
            return (
              <li key={entry.id} className="group flex min-h-11 items-center gap-3 border-b border-line-soft px-4 py-2 text-[13.5px] last:border-b-0">
                <Checkbox
                  checked={entry.done}
                  aria-label={title}
                  onCheckedChange={() => persist(focus.map((f) => (f.id === entry.id ? { ...f, done: !f.done } : f)))}
                />
                <span className="min-w-0 flex-1">
                  {item ? (
                    <button
                      type="button"
                      onClick={() => onOpenItem(item.id)}
                      className={cn('block max-w-full truncate text-left font-medium text-ink hover:underline', entry.done && 'text-ink-muted line-through')}
                    >
                      {title}
                    </button>
                  ) : (
                    <span className={cn('block truncate text-ink', entry.done && 'text-ink-muted line-through')}>{title}</span>
                  )}
                  {item ? <span className="block truncate text-[12px] text-ink-muted">{item.companyName}</span> : null}
                </span>
                {item && hand ? <HandMenu item={item} owner={owner} hand={hand} /> : null}
                <Button
                  size="icon"
                  variant="quiet"
                  className="h-7 w-7 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label={`Remove · ${title}`}
                  onClick={() => persist(focus.filter((f) => f.id !== entry.id))}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.6} />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The lead's face when the item has one, else a dashed person-plus button; both open the lead menu. */
function HandMenu({ item, owner, hand }: { item: InternWorkItem; owner: Person | undefined; hand: TodoHandOff }) {
  const movable = hand.canHand(item);
  const people = hand.leads.filter((l) => l.id !== owner?.id);
  const label = owner ? `With ${owner.name}. Hand to another project lead` : 'Hand to a project lead';
  if (!movable || people.length === 0) {
    return owner ? (
      <span title={`With ${owner.name}`} className="flex-none">
        <PersonAvatar name={owner.name} size={24} />
      </span>
    ) : null;
  }
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={cn(
            'grid h-7 w-7 flex-none place-items-center rounded-full text-ink-muted hover:text-ink',
            !owner && 'border-1.5 border-dashed border-line-strong',
          )}
        >
          {owner ? <PersonAvatar name={owner.name} size={24} /> : <UserRoundPlus className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={12} className="max-h-[320px] w-[220px] overflow-y-auto">
        <DropdownMenuLabel className="pb-1 text-[12px] font-medium text-ink-muted">Hand to</DropdownMenuLabel>
        {people.map((p) => (
          <DropdownMenuItem key={p.id} onSelect={() => hand.onHand(item, p)} className="flex h-[34px] items-center gap-2">
            <PersonAvatar name={p.name} size={24} />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** New to-do dialog (prototype `NewTodoDialog`). The personal to-do store keeps a title only. */
export function NewTodoDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (title: string) => void;
}) {
  const [text, setText] = useState('');
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setText('');
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-medium">New to-do</DialogTitle>
        </DialogHeader>
        <form
          id="new-todo"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            onAdd(text.trim());
            onOpenChange(false);
          }}
        >
          <WorkField label="To-do">
            {(id) => <Input id={id} value={text} onChange={(e) => setText(e.target.value)} maxLength={INTERN_FOCUS_TITLE_MAX} />}
          </WorkField>
        </form>
        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="new-todo" disabled={!text.trim()}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
