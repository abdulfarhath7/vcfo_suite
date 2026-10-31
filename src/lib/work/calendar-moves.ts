import { addDaysYmd, istIso, isValidBlockRange } from '@/lib/work/planner';

/**
 * Move rules for the staff calendars (the Planner and the compliance calendar, M6 G2).
 * Each calendar event has one kind, and the kind alone decides what a drag does:
 *
 *   block          a time block in the planner. It moves and resizes freely.
 *   planned        a planned work date (a non-statutory compliance task's start and end).
 *                  It moves freely for a person who may edit the task.
 *   statutory      a statutory due date. It never moves and is never draggable.
 *   client-agreed  a date agreed with the client (the manager-set window on a step). A drag
 *                  does not move it: it opens a date-change request (`/api/work/window-requests`)
 *                  for a project lead to send to the manager.
 *   due            any other deadline the calendar shows (a step, a request or an assigned task).
 *                  It belongs to its own workflow, so the calendar does not move it.
 *
 * The functions are pure, so the rules are unit tested in `calendar-moves.test.ts`.
 */
export type CalendarEventKind = 'block' | 'planned' | 'statutory' | 'client-agreed' | 'due';

export interface MoveRights {
  /** The viewer may change the event directly (owns the block, or may edit the task). */
  canEdit: boolean;
  /** The viewer may ask for a date change (a project lead, `canRequestWindowChange`). */
  canRequest: boolean;
}

export type MoveDecision =
  | { action: 'move' }
  | { action: 'request' }
  | { action: 'locked'; reason: string };

export const LOCK_REASON: Record<'statutory' | 'client-agreed' | 'due' | 'read-only', string> = {
  statutory: 'Statutory due dates do not move.',
  'client-agreed': 'Your manager changes dates agreed with the client.',
  due: 'Plan a time block for this item instead.',
  'read-only': 'You may not change this date.',
};

/** What a drag (or a keyboard move) of an event of this kind does for this viewer. */
export function moveDecision(kind: CalendarEventKind, rights: MoveRights): MoveDecision {
  switch (kind) {
    case 'statutory':
      return { action: 'locked', reason: LOCK_REASON.statutory };
    case 'due':
      return { action: 'locked', reason: LOCK_REASON.due };
    case 'client-agreed':
      return rights.canRequest ? { action: 'request' } : { action: 'locked', reason: LOCK_REASON['client-agreed'] };
    case 'block':
    case 'planned':
      return rights.canEdit ? { action: 'move' } : { action: 'locked', reason: LOCK_REASON['read-only'] };
  }
}

/** The kind of a due item in the Planner's all-day row: filings are statutory, manager windows are client-agreed. */
export function plannerItemKind(item: { source?: string; managerDated?: boolean }): CalendarEventKind {
  if (item.source === 'filing') return 'statutory';
  if (item.managerDated) return 'client-agreed';
  return 'due';
}

/** True when the calendar lets the viewer pick the event up at all. Statutory events never. */
export function isDraggable(kind: CalendarEventKind, rights: MoveRights): boolean {
  return moveDecision(kind, rights).action !== 'locked';
}

/** True when the viewer may drag the event's bottom edge. Only events that move freely resize. */
export function isResizable(kind: CalendarEventKind, rights: MoveRights): boolean {
  return moveDecision(kind, rights).action === 'move';
}

/** Whole days from `fromYmd` to `toYmd` (negative when `toYmd` is earlier). */
export function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86_400_000);
}

/**
 * The window a date-change request asks for when a client-agreed item is dragged from
 * `fromYmd` to `toYmd`: the whole window shifts by the same number of days. Without a
 * current window the request names the new day as both ends. Returns null when the item
 * did not move.
 */
export function requestedWindowForDrag(
  current: { from: string; to: string } | null | undefined,
  fromYmd: string,
  toYmd: string,
): { fromDate: string; toDate: string } | null {
  const delta = daysBetween(fromYmd, toYmd);
  if (delta === 0) return null;
  if (!current) return { fromDate: toYmd, toDate: toYmd };
  return { fromDate: addDaysYmd(current.from, delta), toDate: addDaysYmd(current.to, delta) };
}

/**
 * The new start and end dates of a planned task after a drag or a resize. `startDelta`
 * and `endDelta` are whole days; a move passes the same value twice, a resize of the
 * bottom edge passes 0 for the start. Returns null when the result would end before it
 * starts or nothing changed.
 */
export function shiftPlannedDates(
  dates: { startDate: string; dueDate: string },
  startDelta: number,
  endDelta: number,
): { startDate: string; dueDate: string } | null {
  if (startDelta === 0 && endDelta === 0) return null;
  const startDate = addDaysYmd(dates.startDate.slice(0, 10), startDelta);
  const dueDate = addDaysYmd(dates.dueDate.slice(0, 10), endDelta);
  return startDate <= dueDate ? { startDate, dueDate } : null;
}

/* ------------------------------------------------------------- wall clock */

/**
 * The calendars run FullCalendar in its UTC mode and feed it India Standard Time wall
 * clock values, because IST has a fixed +05:30 offset and FullCalendar needs a plug-in for
 * named zones. `toWallIso` turns a stored timestamp into that wall-clock value and
 * `fromWallDate` turns a FullCalendar date back into a stored timestamp.
 */
const IST_MS = 330 * 60_000;

export function toWallIso(iso: string): string {
  return new Date(Date.parse(iso) + IST_MS).toISOString().slice(0, 19);
}

export function wallYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function wallHhmm(d: Date): string {
  return d.toISOString().slice(11, 16);
}

/** A FullCalendar date (UTC fields hold the IST wall clock) as a stored ISO timestamp. */
export function fromWallDate(d: Date): string {
  return istIso(wallYmd(d), wallHhmm(d));
}

/** "Now" for FullCalendar's now line, in the same wall-clock mode. */
export function wallNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + IST_MS);
}

/**
 * The stored times of a block moved to wall-clock `start` and `end`. A block that would
 * end on the next day ends at 23:59. Returns null when the range is not a valid block
 * (inside one day, 15 minutes to the longest block).
 */
export function blockTimesFromWall(start: Date, end: Date | null, fallbackMinutes = 60): { startsAt: string; endsAt: string } | null {
  const realEnd = end ?? new Date(start.getTime() + fallbackMinutes * 60_000);
  const day = wallYmd(start);
  const endsAt = wallYmd(realEnd) !== day ? istIso(day, '23:59') : istIso(day, wallHhmm(realEnd));
  const startsAt = istIso(day, wallHhmm(start));
  return isValidBlockRange(startsAt, endsAt) ? { startsAt, endsAt } : null;
}

/**
 * Keyboard moves on a focused calendar event (Google Calendar has none, so the rule is
 * ours): Up and Down move it 15 minutes, Left and Right move it one day, and Shift with Up
 * or Down changes its end. Returns null for any other key.
 */
export function keyboardMove(key: string, shift: boolean): { minutes: number; days: number; resize: boolean } | null {
  if (key === 'ArrowUp') return { minutes: -15, days: 0, resize: shift };
  if (key === 'ArrowDown') return { minutes: 15, days: 0, resize: shift };
  if (shift) return null;
  if (key === 'ArrowLeft') return { minutes: 0, days: -1, resize: false };
  if (key === 'ArrowRight') return { minutes: 0, days: 1, resize: false };
  return null;
}
