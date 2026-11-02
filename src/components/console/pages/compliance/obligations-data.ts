'use client';

/**
 * Data behind the console's Obligations pages. Statutory rows come from the
 * book (`useBook`, the same `/api/filings` + `/api/client/compliances` reads
 * the Filings register and the Calendar use). Non-statutory tasks and the two
 * detail reads come from the routes in docs/ui-port/COMPLIANCE-API.md through
 * the live staff screens' TanStack hooks (`@/views/compliances/tasks/api`), so
 * the console and the old-shell views share one cache: a write on either side
 * refreshes the other. Only the filtered task list is new here, because the
 * live hook does not pass `status`, `urgency`, `visibility` or `mine`.
 */
import { useQuery } from '@tanstack/react-query';
import { ApiError, TASKS_KEY, type TaskRowDto } from '@/views/compliances/tasks/api';
import { taskQuery, type TaskFilters } from './obligations-model';

export {
  ApiError,
  openTaskAttachment,
  useActivities,
  useCreateTask,
  useSetReminderDays,
  useStatutory,
  useStatutoryAction,
  useTask,
  useTaskActions,
  useTaskDefaults,
  type CreateTaskBody,
  type HistoryDto,
  type Person,
  type ReminderKey,
  type ReminderRowDto,
  type StatutoryDetailDto,
  type StepDto,
  type TaskDefaultsDto,
  type TaskDetailDto,
  type TaskEditBody,
  type TaskRowDto,
} from '@/views/compliances/tasks/api';

/** `GET /api/compliances/tasks` with every filter the route offers. Not-applicable rows stay out. */
export function useTaskList(f: TaskFilters, enabled = true) {
  const qs = taskQuery(f);
  return useQuery({
    queryKey: [...TASKS_KEY, 'console-list', qs],
    enabled,
    queryFn: async (): Promise<{ tasks: TaskRowDto[]; today: string }> => {
      const res = await fetch(`/api/compliances/tasks${qs}`, { cache: 'no-store' });
      const body = (await res.json().catch(() => ({}))) as { tasks?: TaskRowDto[]; today?: string; error?: string };
      if (!res.ok) throw new ApiError(body.error === 'forbidden' ? 'You cannot see these tasks' : 'Could not load the tasks', res.status, body.error);
      return { tasks: body.tasks ?? [], today: body.today ?? '' };
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

/** A route error in plain words (the live hooks already map the codes). */
export const errText = (e: unknown, fallback: string): string => (e instanceof Error && e.message ? e.message : fallback);
