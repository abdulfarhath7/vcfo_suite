'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { InternWorkBoardCard } from '@/components/intern/InternWorkRow';
import { EmptyState } from '@/components/ui/empty-state';
import { Tag } from '@/components/ui/spectrum-chip';
import { toastUndo } from '@/components/ui/undo-toast';
import { useApp } from '@/context/AppContext';
import type { StatusCode } from '@/data/checklist';
import { internWorkBoard, type InternWorkItem } from '@/lib/intern/intern-work';
import { boardDrop, isBoardDraggable, moveInList, type BoardColumn } from '@/lib/work/board-moves';
import { cn } from '@/lib/utils';

const BOARD_COLS: { key: BoardColumn; label: string; tone: 'warn' | 'prog' | 'idle' | 'ok' }[] = [
  { key: 'action', label: 'Needs action', tone: 'warn' },
  { key: 'progress', label: 'In progress', tone: 'prog' },
  { key: 'waiting', label: 'Waiting', tone: 'idle' },
  { key: 'done', label: 'Done', tone: 'ok' },
];

type Cols = Record<BoardColumn, InternWorkItem[]>;
const COL_PREFIX = 'col:';
const labelOf = (key: BoardColumn) => BOARD_COLS.find((c) => c.key === key)!.label;

/**
 * Work board (prototype `WorkBoard`, M6 G1): four quiet columns with a count tag in each head.
 * A task card drags to another column to change its status (`PATCH /api/tasks/:id` through
 * `updateTask`) and inside its column to change its place (`tasks.sort_order`). Steps and
 * filings follow their own workflow, so their cards stay still. Keyboard: Tab to a task card,
 * Space to pick it up, the arrow keys to move it, Space to drop and Escape to cancel. Each
 * change offers Undo.
 */
export function WorkBoard({
  items,
  now,
  onOpen,
  ownerOf,
}: {
  items: InternWorkItem[];
  now: Date;
  onOpen: (item: InternWorkItem) => void;
  /** The lead on each card (manager Work). */
  ownerOf?: (item: InternWorkItem) => string | undefined;
}) {
  const { updateTask } = useApp();
  const base = useMemo(() => internWorkBoard(items, now), [items, now]);
  const [live, setLive] = useState<Cols | null>(null);
  const cols = live ?? base;
  const from = useRef<BoardColumn | null>(null);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A long press picks a card up on a phone, so a swipe still scrolls the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const colOf = (state: Cols, id: string): BoardColumn | null => {
    if (id.startsWith(COL_PREFIX)) return id.slice(COL_PREFIX.length) as BoardColumn;
    return (Object.keys(state) as BoardColumn[]).find((k) => state[k].some((i) => i.id === id)) ?? null;
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    from.current = colOf(base, String(active.id));
    setLive(base);
  };

  // Across columns: move the card into the column under the pointer while it is dragged.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !live) return;
    const id = String(active.id);
    const a = colOf(live, id);
    const b = colOf(live, String(over.id));
    if (!a || !b || a === b) return;
    const card = live[a].find((i) => i.id === id);
    if (!card) return;
    const target = live[b].filter((i) => i.id !== id);
    const at = String(over.id).startsWith(COL_PREFIX) ? target.length : Math.max(0, target.findIndex((i) => i.id === String(over.id)));
    target.splice(at, 0, card);
    setLive({ ...live, [a]: live[a].filter((i) => i.id !== id), [b]: target });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const state = live;
    const start = from.current;
    setLive(null);
    from.current = null;
    if (!over || !state || !start) return;
    const id = String(active.id);
    const item = byId.get(id);
    const to = colOf(state, id);
    if (!item || !to) return;
    let list = state[to];
    const overId = String(over.id);
    if (!overId.startsWith(COL_PREFIX) && overId !== id) {
      const a = list.findIndex((i) => i.id === id);
      const b = list.findIndex((i) => i.id === overId);
      if (a >= 0 && b >= 0) list = moveInList(list, a, b);
    }
    apply(item, start, to, list);
  };

  const apply = (item: InternWorkItem, start: BoardColumn, to: BoardColumn, list: InternWorkItem[]) => {
    const drop = boardDrop(item, start, to, list);
    if (drop.action === 'none') return;
    const stamp = () => new Date().toISOString();
    const before = new Map(list.filter((i) => i.taskId).map((i) => [i.taskId!, i.sortOrder ?? null]));
    const prevStatus: StatusCode = item.taskStatus ?? 'not-started';
    const others = drop.patches.filter((p) => drop.action !== 'status' || p.taskId !== drop.taskId);
    for (const p of others) updateTask(p.taskId, { sortOrder: p.sortOrder });
    if (drop.action === 'status') {
      const own = drop.patches.find((p) => p.taskId === drop.taskId);
      updateTask(drop.taskId, { status: drop.status, updatedAt: stamp(), ...(own ? { sortOrder: own.sortOrder } : {}) });
    }
    const undo = () => {
      for (const p of others) updateTask(p.taskId, { sortOrder: before.get(p.taskId) ?? null });
      if (drop.action === 'status') {
        updateTask(drop.taskId, { status: prevStatus, updatedAt: stamp(), sortOrder: before.get(drop.taskId) ?? null });
      }
    };
    toastUndo(drop.action === 'status' ? `${item.title} · ${labelOf(drop.to)}` : `${item.title} · moved`, undo);
  };

  const title = (id: string | number) => byId.get(String(id))?.title ?? 'Card';
  const where = (id: string | number | undefined) => {
    if (id === undefined) return '';
    const state = live ?? base;
    const col = colOf(state, String(id));
    if (!col) return '';
    const at = state[col].findIndex((i) => i.id === String(id));
    return at >= 0 ? `${labelOf(col)}, position ${at + 1}` : labelOf(col);
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${title(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${title(active.id)} is over ${where(over.id)}.` : `${title(active.id)} is not over a column.`),
    onDragEnd: ({ active, over }) => (over ? `${title(active.id)} dropped in ${where(active.id)}.` : `${title(active.id)} dropped back.`),
    onDragCancel: ({ active }) => `Move of ${title(active.id)} cancelled.`,
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setLive(null);
        from.current = null;
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'Press Space to pick up the task. Use the arrow keys to move it. Press Space again to drop it, or Escape to cancel.',
        },
      }}
    >
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        {BOARD_COLS.map((col) => (
          <BoardColumnSection key={col.key} col={col} count={cols[col.key].length}>
            <SortableContext items={cols[col.key].map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {cols[col.key].length === 0 ? <EmptyState title="None" className="min-h-[72px] py-4" /> : null}
              {cols[col.key].map((item) => (
                <SortableCard key={item.id} item={item}>
                  <InternWorkBoardCard item={item} now={now} dim={col.key === 'done'} onOpen={onOpen} owner={ownerOf?.(item)} />
                </SortableCard>
              ))}
            </SortableContext>
          </BoardColumnSection>
        ))}
      </div>
    </DndContext>
  );
}

function BoardColumnSection({ col, count, children }: { col: (typeof BOARD_COLS)[number]; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COL_PREFIX}${col.key}` });
  return (
    <section
      ref={setNodeRef}
      data-col={col.key}
      aria-label={col.label}
      className={cn('min-w-0 rounded-md border-1.5 border-line bg-surface-sunken', isOver && 'border-brand')}
    >
      <header className="flex h-11 items-center gap-2 border-b border-line-soft px-4">
        <h2 className="text-[14px] font-medium text-ink">{col.label}</h2>
        <Tag tone={col.tone}>{count}</Tag>
      </header>
      <div className="grid min-h-[72px] gap-2 p-3">{children}</div>
    </section>
  );
}

function SortableCard({ item, children }: { item: InternWorkItem; children: ReactNode }) {
  const draggable = isBoardDraggable(item);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !draggable });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...(draggable ? { ...attributes, ...listeners, 'aria-label': `Move ${item.title}` } : {})}
      className={cn(
        'min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        draggable && 'cursor-grab active:cursor-grabbing',
        isDragging && 'relative z-10 shadow-float',
      )}
    >
      {children}
    </div>
  );
}
