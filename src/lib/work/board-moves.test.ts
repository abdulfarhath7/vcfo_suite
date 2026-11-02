import { describe, expect, it } from 'vitest';
import { boardDrop, columnOfTaskStatus, isBoardDraggable, moveInList, orderColumn, sortOrderPatches } from '@/lib/work/board-moves';

const step = (id: string) => ({ id, source: 'step' as const });
const task = (id: string, sortOrder?: number) => ({ id, source: 'task' as const, taskId: id, sortOrder });

describe('board moves', () => {
  it('lets only task cards move', () => {
    expect(isBoardDraggable(task('t1'))).toBe(true);
    expect(isBoardDraggable(step('s1'))).toBe(false);
    expect(isBoardDraggable({ source: 'task' })).toBe(false);
  });

  it('maps task statuses to columns', () => {
    expect(columnOfTaskStatus('not-started')).toBe('action');
    expect(columnOfTaskStatus('in-progress')).toBe('progress');
    expect(columnOfTaskStatus('awaiting-client')).toBe('waiting');
    expect(columnOfTaskStatus('completed')).toBe('done');
    expect(columnOfTaskStatus(undefined)).toBe('action');
  });

  it('refills task slots by sort order and leaves steps in place', () => {
    const shown = orderColumn([step('s1'), task('a', 2), step('s2'), task('b', 1), task('c')]);
    expect(shown.map((i) => i.id)).toEqual(['s1', 'b', 's2', 'a', 'c']);
  });

  it('numbers the tasks of a reordered column and saves only the changes', () => {
    const list = moveInList([task('a', 1), task('b', 2), task('c', 3)], 2, 0);
    expect(list.map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(sortOrderPatches(list)).toEqual([
      { taskId: 'c', sortOrder: 1 },
      { taskId: 'a', sortOrder: 2 },
      { taskId: 'b', sortOrder: 3 },
    ]);
    expect(sortOrderPatches([task('a', 1), step('s'), task('b', 2)])).toEqual([]);
  });

  it('changes the status on a drop in another column', () => {
    const drop = boardDrop(task('a'), 'action', 'done', [task('a')]);
    expect(drop).toEqual({ action: 'status', taskId: 'a', status: 'completed', to: 'done', patches: [{ taskId: 'a', sortOrder: 1 }] });
  });

  it('reorders on a drop in the same column and does nothing for a step', () => {
    expect(boardDrop(task('b', 2), 'action', 'action', [task('b', 2), task('a', 1)]).action).toBe('order');
    expect(boardDrop(task('a', 1), 'action', 'action', [task('a', 1)])).toEqual({ action: 'none' });
    expect(boardDrop(step('s'), 'action', 'done', [])).toEqual({ action: 'none' });
  });
});
