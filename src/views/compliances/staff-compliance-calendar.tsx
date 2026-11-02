'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StaffCalendar, type StaffMove } from '@/components/work/calendar/StaffCalendar';
import { complianceEvents } from '@/views/compliances/staff-calendar-events';
import { toastUndo } from '@/components/ui/undo-toast';
import type { Engagement } from '@/data/engagements';
import { addDaysYmd } from '@/lib/work/planner';
import { moveDecision, shiftPlannedDates, wallYmd } from '@/lib/work/calendar-moves';
import type { FilingRow } from '@/lib/compliance/filings';
import { errorMessage, toastError } from '@/lib/toast-errors';
import { useMoveTaskDates, type TaskRowDto } from '@/views/compliances/tasks/api';
import { NewTaskButton } from '@/views/compliances/tasks/new-task';

/**
 * The staff compliance calendar grid (M6 G2): FullCalendar Day, Week and Month day cells
 * with the statutory filings and the non-statutory tasks the bar filters chose. Filings
 * show their statutory due date and never move. A task runs from its start to its end date
 * and moves (drag) or changes its end (drag the right edge) through the task edit route,
 * for an admin, super admin or manager, with Undo. A click on an empty day opens the
 * New task form on that day for them. A click on an event opens its record or task page.
 */
export function StaffComplianceCalendar({
  rows,
  tasks,
  now,
  month,
  onMonth,
  engagements,
  companyId,
  showCompany,
  recordHref,
  taskHref,
  canEdit,
}: {
  rows: FilingRow[];
  tasks: TaskRowDto[];
  now: Date;
  /** `YYYY-MM-DD`, the first of the month the bar shows. */
  month: string;
  /** The calendar moved to another month. */
  onMonth: (firstOfMonth: string) => void;
  engagements: Engagement[];
  companyId: string | null;
  showCompany: boolean;
  recordHref: (row: FilingRow) => string;
  taskHref: (t: TaskRowDto) => string;
  /** An admin, super admin or manager: tasks move and an empty day opens New task. */
  canEdit: boolean;
}) {
  const router = useRouter();
  const rights = useMemo(() => ({ canEdit, canRequest: false }), [canEdit]);
  const move = useMoveTaskDates();
  const [slot, setSlot] = useState<{ start: string; end: string } | null>(null);
  const events = useMemo(() => complianceEvents({ rows, tasks, now, showCompany }), [rows, tasks, now, showCompany]);
  const rowById = useMemo(() => new Map(rows.map((r) => [`stat:${r.id}`, r])), [rows]);
  const taskById = useMemo(() => new Map(tasks.map((t) => [`task:${t.id}`, t])), [tasks]);

  const onMove = (m: StaffMove) => {
    const decision = moveDecision(m.event.kind, rights);
    if (decision.action !== 'move') {
      m.revert();
      if (decision.action === 'locked') toastError("Couldn't move it", decision.reason);
      return;
    }
    const t = taskById.get(m.event.id);
    if (!t) return m.revert();
    const before = { startDate: t.startDate.slice(0, 10), dueDate: t.dueDate.slice(0, 10) };
    const next = shiftPlannedDates(before, m.startDays, m.endDays);
    if (!next) {
      m.revert();
      return;
    }
    move.mutate(
      { id: t.id, ...next },
      {
        onSuccess: () => toastUndo(`${t.title} · ${next.startDate} to ${next.dueDate}`, () => move.mutate({ id: t.id, ...before })),
        onError: (err) => {
          m.revert();
          toastError("Couldn't move the task", errorMessage(err));
        },
      },
    );
  };

  return (
    <>
      <StaffCalendar
        title="Calendar"
        events={events}
        rights={rights}
        now={now}
        timed={false}
        initialDate={month}
        date={month}
        initialMode="month"
        onMove={canEdit ? onMove : undefined}
        onOpen={(ev) => {
          const row = rowById.get(ev.id);
          if (row) return router.push(recordHref(row));
          const t = taskById.get(ev.id);
          if (t) router.push(taskHref(t));
        }}
        onSlot={
          canEdit
            ? ({ start, end }) => {
                const s = wallYmd(start);
                const e = addDaysYmd(wallYmd(end), -1);
                setSlot({ start: s, end: e < s ? s : e });
              }
            : undefined
        }
        onRange={({ from, to, mode }) => {
          // The bar's month follows the calendar: the month of the middle of the range.
          const mid = mode === 'month' ? addDaysYmd(from, 15) : from;
          const first = `${mid.slice(0, 7)}-01`;
          if (first !== month && to) onMonth(first);
        }}
      />
      {canEdit ? (
        <NewTaskButton
          engagements={engagements}
          defaultClient={companyId ?? undefined}
          now={now}
          prefill={slot}
          onPrefillDone={() => setSlot(null)}
          hideTrigger
        />
      ) : null}
    </>
  );
}
