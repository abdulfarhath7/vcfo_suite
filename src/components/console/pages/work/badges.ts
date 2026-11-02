'use client';

/**
 * Nav badges from the planner model (prototype mxNavBadge):
 *   work   your open to-dos plus your dated work due by the end of next week;
 *          red when any of it is overdue
 *   tasks  (lead seat) open items in the lead's queue; red when any is overdue
 */
import { useApp } from '@/context/AppContext';
import { usePersonalTodos } from '@/lib/use-personal-todos';
import { useConsoleBadge } from '../../runtime';
import { addDays, weekOf } from '../today/model';
import { usePlan } from './planner/data';

export function useWorkBadge(): void {
  const { user } = useApp();
  const plan = usePlan({ mode: 'mgr-me' });
  const todos = usePersonalTodos(Boolean(user?.id));
  const end = addDays(weekOf(plan.today)[6]!, 7);
  const open = plan.items.filter((i) => i.st !== 'done' && (!i.due || i.due <= end));
  const mine = (todos.data ?? []).filter((t) => t.ownerId === user?.id && !t.done && (t.custom || t.title.trim())).length;
  useConsoleBadge('work', plan.loading ? undefined : open.length + mine, open.some((i) => i.st === 'over') ? 'hot' : '');
}

export function useLeadTasksBadge(): void {
  const plan = usePlan({ mode: 'lead-me' });
  const open = plan.items.filter((i) => i.st !== 'done');
  useConsoleBadge('tasks', plan.loading ? undefined : open.length, open.some((i) => i.st === 'over') ? 'hot' : '');
}
