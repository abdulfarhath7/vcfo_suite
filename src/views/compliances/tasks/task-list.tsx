'use client';

import { UrgencyPill, VisibilityTag } from '@/components/compliances/TaskMarks';
import type { GridColumn, GridGroup } from '@/views/compliances/grouped-grid';
import { PersonCell } from '@/views/compliances/identity';
import { WordChip } from '@/views/compliances/spectrum-parts';
import { Tag } from '@/components/ui/spectrum-chip';
import { plainDate } from '@/lib/compliance/spectrum-status';
import type { TaskRowDto } from '@/views/compliances/tasks/api';
import { taskRowMatches, tasksByWeek } from '@/views/compliances/tasks/task-model';

/**
 * The non-statutory task table of the staff Obligations list (prototype ns-parts, S-3): a T1
 * table grouped by end-date week. The server sends the week, the six-word status and the
 * days to due, so the list and the detail page always agree.
 */

const WEEK_DOT: Record<string, string> = {
  'This week': 'bg-warning-mid',
  'Next week': 'bg-brand',
  Later: 'bg-brand',
  Done: 'bg-positive-mid',
};

/** The statutory detail page of one client's period (4.2): /obligations/<obligation>/<instance>. */
export function statHref(basePath: string, obligationId: string, instanceId: string): string {
  return `${basePath}/obligations/${encodeURIComponent(obligationId)}/${encodeURIComponent(instanceId)}`;
}

export function taskHref(basePath: string, id: string, boardMeetingId?: string | null): string {
  if (boardMeetingId) return meetingPageHref(basePath, boardMeetingId);
  return `${basePath}/obligations/tasks/${encodeURIComponent(id)}`;
}

/** A board meeting's page: Obligations › Non-statutory › the meeting (docs/specs/board-meetings/PLAN.md). */
function meetingPageHref(basePath: string, meetingId: string): string {
  return `${basePath}/obligations/meetings/${encodeURIComponent(meetingId)}`;
}

/** Rows group by end-date week: This week, Next week, Later, Done (latest done first). */
export function taskGroups(tasks: TaskRowDto[]): GridGroup<TaskRowDto>[] {
  return tasksByWeek(tasks).map(({ week, rows }) => ({ id: `week-${week}`, label: week, dot: WEEK_DOT[week], rows }));
}

export { taskRowMatches };

/** T1 columns: Task (name + client), Start, End, Urgency, Visibility, Owner, Status. Phones keep Task, End and Status. */
export function taskColumns(now: Date): GridColumn<TaskRowDto>[] {
  return [
    {
      key: 'task',
      label: 'Task',
      className: 'w-full max-w-0',
      render: (t) => (
        <span className="block min-w-0">
          <b className="flex min-w-0 items-center gap-2 text-[14px] font-medium text-ink" title={t.title}>
            {t.boardMeetingId ? <Tag tone="prog">Meeting</Tag> : null}
            <span className="truncate">{t.title}</span>
          </b>
          <span className="block truncate text-[12.5px] text-ink-muted">{t.companyName}</span>
        </span>
      ),
    },
    {
      key: 'start',
      label: 'Start',
      width: 76,
      className: 'hidden md:table-cell',
      render: (t) => <span className="whitespace-nowrap text-ink-muted">{plainDate(t.startDate, now)}</span>,
    },
    {
      key: 'end',
      label: 'End',
      width: 76,
      render: (t) => {
        const late = t.word === 'Overdue';
        return (
          <span
            className={late ? 'whitespace-nowrap font-medium text-danger' : 'whitespace-nowrap text-ink-2'}
            title={late ? `${-t.daysToDue} day${t.daysToDue === -1 ? '' : 's'} late` : undefined}
          >
            {plainDate(t.dueDate, now)}
          </span>
        );
      },
    },
    { key: 'urgency', label: 'Urgency', width: 108, className: 'hidden md:table-cell', render: (t) => <UrgencyPill urgency={t.urgency} /> },
    { key: 'vis', label: 'Visibility', width: 96, className: 'hidden lg:table-cell', render: (t) => <VisibilityTag visibility={t.visibility} /> },
    { key: 'owner', label: 'Owner', width: 140, className: 'hidden md:table-cell', render: (t) => <PersonCell name={t.owner?.name} /> },
    { key: 'status', label: 'Status', width: 124, render: (t) => <WordChip word={t.word} /> },
  ];
}
