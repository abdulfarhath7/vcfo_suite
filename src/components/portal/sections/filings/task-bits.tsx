'use client';

/**
 * The small shared pieces for non-statutory tasks on Calendar and Filings:
 *  - TaskTag:      "Task" with the hollow square (C-3), where a filing shows its law chip;
 *  - TaskWordPill: the six-word status chip (R-13) as a prototype pill;
 *  - CategorySeg:  the All · Statutory · Non-statutory switch with counts (C-1, F-1);
 *  - useCategory:  that switch's value, kept in `?cat=` (C-1, F-1);
 *  - useOpenTask:  a click on a task sets the portal intent { kind: 'task', id };
 *  - useOpenDeliverable: F-2, opens a done task's deliverable through its signed URL.
 */
import { useCallback, useEffect, useState } from 'react';
import { taskHint, taskWord, type ClientTask, type TaskRow } from '@/components/client-portal/pages/compliances/tasks';
import { attachmentUrl } from '@/components/client-portal/pages/compliances/task-api';
import { usePortal } from '../../runtime';
import { Seg } from '../../ui';
import { catSearch, readCat, WORD_PILL, type Category } from './tasks-model';

export function TaskTag({ task, small }: { task?: Pick<ClientTask, 'startDate' | 'urgency'>; small?: boolean }) {
  return (
    <span className={'ttag' + (small ? ' sm' : '')} title={task ? taskHint(task) : 'Non-statutory task'}>
      <i className="tsq" aria-hidden="true" />
      Task
    </span>
  );
}

export function TaskWordPill({ task, today, tiny }: { task: Pick<ClientTask, 'stage' | 'endDate' | 'notifyDays'>; today: string; tiny?: boolean }) {
  const w = taskWord(task, today);
  return <span className={`pill ${WORD_PILL[w]}${tiny ? ' tiny' : ''}`}>{w}</span>;
}

export function CategorySeg({ value, onChange, stat, ns }: { value: Category; onChange: (c: Category) => void; stat: number; ns: number }) {
  return (
    <Seg<Category>
      ariaLabel="Category"
      value={value}
      onChange={onChange}
      options={[
        { value: 'all', label: 'All', n: stat + ns },
        { value: 'statutory', label: 'Statutory', n: stat },
        { value: 'non-statutory', label: 'Non-statutory', n: ns },
      ]}
    />
  );
}

/**
 * The category switch, kept in `?cat=` so a refresh lands on the same view.
 * Starts on All and reads the URL after mount (the sections are server-rendered
 * once, so reading `location` in the initial state would mismatch on hydration).
 */
export function useCategory(): [Category, (c: Category) => void] {
  const [cat, setCat] = useState<Category>('all');
  useEffect(() => {
    setCat(readCat(window.location.search));
  }, []);
  const set = useCallback((c: Category) => {
    setCat(c);
    const url = new URL(window.location.href);
    url.search = catSearch(url.search, c);
    window.history.replaceState(window.history.state, '', url);
  }, []);
  return [cat, set];
}

/** A click on a task anywhere on Calendar or Filings opens it (the Obligations section handles the intent). */
export function useOpenTask(): (r: TaskRow | string) => void {
  const { setIntent } = usePortal();
  return useCallback((r: TaskRow | string) => setIntent({ kind: 'task', id: typeof r === 'string' ? r : r.task.id }), [setIntent]);
}

/** F-2: open the deliverable of a done task in a new tab (GET …/attachments/:id → { url }). */
export function useOpenDeliverable(): (r: TaskRow) => Promise<void> {
  const { toast } = usePortal();
  return useCallback(
    async (r: TaskRow) => {
      const d = r.task.deliverable;
      if (!d) return;
      try {
        const url = await attachmentUrl(r.task.id, d.id);
        window.open(url, '_blank', 'noopener');
      } catch {
        toast('Could not open the deliverable');
      }
    },
    [toast],
  );
}
