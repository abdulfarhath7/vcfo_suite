'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { WorkField } from '@/components/work/WorkField';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  INTERN_FOCUS_TITLE_MAX,
  isCustomInternFocus,
  type InternFocusEntry,
  type InternWorkItem,
} from '@/lib/intern/intern-work';
import { cn } from '@/lib/utils';

/**
 * Planner to-dos card (prototype `TodoCard`): the lead's personal to-dos, the same list as
 * the Today to-do card (`useOwnFocusTodos`, `/api/todos`). A typed to-do shows its title;
 * a pinned work item opens the task drawer.
 */
export function PlannerTodos({
  focus,
  byId,
  persist,
  onOpenItem,
  onNew,
}: {
  focus: InternFocusEntry[];
  byId: Map<string, InternWorkItem>;
  persist: (next: InternFocusEntry[]) => void;
  onOpenItem: (id: string) => void;
  onNew: () => void;
}) {
  const open = focus.filter((f) => !f.done).length;
  return (
    <section className="surface min-w-0 overflow-hidden">
      <div className="flex min-h-[52px] items-center gap-2 border-b border-line-soft px-4">
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">To-dos</h2>
        <span className="text-[12.5px] text-ink-muted tabular-nums">{open} open</span>
        <Button size="sm" variant="secondary" onClick={onNew}>
          New to-do
        </Button>
      </div>
      {focus.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No to-dos" />
        </div>
      ) : (
        <ul>
          {focus.map((entry) => {
            const item = isCustomInternFocus(entry) ? undefined : byId.get(entry.id);
            const title = item?.title ?? entry.title ?? 'To-do';
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
