'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import type { StatusCode } from '@/data/checklist';
import type { SixWord } from '@/components/ui/status-menu';
import { toastSaved } from '@/components/ui/toast-saved';
import { toastUndo } from '@/components/ui/undo-toast';
import { errorMessage, toastError } from '@/lib/toast-errors';
import { workItemKeyFor } from '@/lib/work/work-item-key';
import type { WorkCompletionDto } from '@/components/work/use-work';

/*
 * Row and bulk actions shared by the staff tables (VCFO Spectrum E-01 to E-03): Team tasks, the
 * lead's Work list and the Clients lists. Every action goes through a route that already exists:
 *   Remind     POST /api/engagements/:id/remind (one reminder per item per 24 hours)
 *   Reassign   POST /api/work/reassign (admin, super admin or manager)
 *   Mark done  the task drawer's own paths: PATCH /api/tasks/:id for a task, an approved document
 *              request, the direct-flow step submit when the checklist validator finds nothing
 *              missing, or PATCH /api/filings/:id/status for a filing that carries its real
 *              compliance instance id. Every other step keeps its form.
 * Undo is offered only where the server can take the change back: a task status, and a filing
 * marked filed by a manager or admin (who may reopen it).
 */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/* --------------------------------------------------------------------- CSV */

/** One CSV cell: quoted when it holds a comma, a quote or a line break. */
export function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Array<Array<string | number | null | undefined>>): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** Saves the picked rows as a CSV file in the browser. Nothing is sent anywhere. */
export function exportRowsCsv(filename: string, header: string[], rows: Array<Array<string | number | null | undefined>>): void {
  const url = URL.createObjectURL(new Blob([toCsv(header, rows)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toastSaved(`Exported ${plural(rows.length, 'row', 'rows')}`, { sub: filename });
}

/* ------------------------------------------------------------------ remind */

export interface RemindTarget {
  engagementId: string;
  /** `step:…` or `request:…`, from `remindableItemKey`. */
  itemKey: string;
  title: string;
}

/**
 * Sends one reminder per target, one after another, and shows one A1 toast with the outcome.
 * An item already reminded today counts as "already reminded", not as a failure.
 */
export async function remindMany(targets: RemindTarget[]): Promise<{ sent: number; limited: number; failed: number }> {
  let sent = 0;
  let limited = 0;
  let failed = 0;
  for (const t of targets) {
    try {
      const res = await fetch(`/api/engagements/${encodeURIComponent(t.engagementId)}/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKey: t.itemKey }),
      });
      if (res.ok) sent += 1;
      else if (res.status === 429) limited += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  const notes = [limited ? `${limited} already reminded today` : '', failed ? `${failed} could not be sent` : ''].filter(Boolean);
  if (sent > 0) {
    toastSaved(sent === 1 && targets.length === 1 ? `Reminder sent · ${targets[0]!.title}` : `${plural(sent, 'reminder', 'reminders')} sent`, {
      sub: notes.join(' · ') || undefined,
    });
  } else if (limited > 0 && failed === 0) {
    toastSaved('Already reminded today', { sub: 'The next reminder can go tomorrow' });
  } else {
    toastError('Could not send the reminder', notes.join(' · ') || undefined);
  }
  return { sent, limited, failed };
}

/* ---------------------------------------------------------------- reassign */

export interface ReassignTarget {
  engagementId: string;
  /** Moves one step or task (`step:…`, `task:…`). */
  itemKey?: string;
  /** Moves the whole client from this lead. */
  fromLeadId?: string;
  title: string;
}

/** Reassigns each target to one lead through `/api/work/reassign`, then one A1 toast. */
export async function reassignMany(targets: ReassignTarget[], to: { id: string; name: string }): Promise<number> {
  let moved = 0;
  const errors: string[] = [];
  for (const t of targets) {
    const body = t.itemKey
      ? { kind: 'item', engagementId: t.engagementId, itemKey: t.itemKey, toLeadId: to.id }
      : { kind: 'lead', engagementId: t.engagementId, fromLeadId: t.fromLeadId, toLeadId: to.id };
    try {
      const res = await fetch('/api/work/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) moved += 1;
      else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        errors.push(data.error ?? `http_${res.status}`);
      }
    } catch (err) {
      errors.push(errorMessage(err));
    }
  }
  if (moved > 0) {
    toastSaved(`${plural(moved, 'item', 'items')} assigned to ${to.name}`, {
      sub: errors.length ? `${errors.length} not moved · ${errors[0]}` : undefined,
    });
  } else {
    toastError('Could not assign', errors[0]);
  }
  return moved;
}

/* --------------------------------------------------------------- mark done */

export interface DoneTarget {
  source: 'step' | 'filing' | 'request' | 'task';
  engagementId: string;
  title: string;
  catalogId?: string;
  requestId?: string;
  taskId?: string;
  /** The real `compliance_instances.id` of a filing (from the register); without it a filing is skipped. */
  filingInstanceId?: string;
  done?: boolean;
}

/** Roles that may reopen a filing, so a Mark filed can be undone. */
const MAY_REOPEN = new Set(['super_admin', 'admin', 'manager']);

/** Marks filings filed (`file`) or reopens them (`reopen`); returns the ids that changed. */
async function setFilingStatus(ids: string[], action: 'file' | 'reopen'): Promise<string[]> {
  const changed: string[] = [];
  for (const id of ids) {
    try {
      const res = await fetch(`/api/filings/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) changed.push(id);
    } catch {
      /* counted as not changed */
    }
  }
  return changed;
}

/**
 * Mark done for many rows, through the drawer's own completion paths only. Rows with no path
 * (a filing, a step that needs its form) are counted and named in the toast, never forced.
 */
export function useMarkDoneMany() {
  const { approveDoc, submitDirectStep, updateTask, user } = useApp();
  const queryClient = useQueryClient();
  return useCallback(
    async (targets: DoneTarget[]) => {
      let done = 0;
      let skipped = 0;
      let other = 0;
      const filingIds: string[] = [];
      for (const t of targets) {
        if (t.done) continue;
        if (t.source === 'filing') {
          if (t.filingInstanceId) filingIds.push(t.filingInstanceId);
          else skipped += 1;
          continue;
        }
        if (t.source === 'task') {
          if (!t.taskId) {
            skipped += 1;
            continue;
          }
          updateTask(t.taskId, { status: 'completed', updatedAt: new Date().toISOString() });
          done += 1;
          other += 1;
          continue;
        }
        const key = workItemKeyFor(t);
        if (!key) {
          skipped += 1;
          continue;
        }
        try {
          const res = await fetch(`/api/work/items?key=${encodeURIComponent(key)}`);
          const data = (await res.json().catch(() => ({}))) as { detail?: { completion: WorkCompletionDto } };
          const completion = res.ok ? data.detail?.completion : undefined;
          if (completion?.mode === 'request' && completion.canComplete && t.requestId) {
            approveDoc(t.requestId);
            done += 1;
            other += 1;
          } else if (completion?.mode === 'direct' && completion.canComplete && t.catalogId) {
            const result = await submitDirectStep(t.engagementId, t.catalogId, {});
            if (result.outcome === 'invalid') skipped += 1;
            else {
              done += 1;
              other += 1;
            }
          } else {
            skipped += 1;
          }
        } catch {
          skipped += 1;
        }
      }
      const filed = filingIds.length ? await setFilingStatus(filingIds, 'file') : [];
      skipped += filingIds.length - filed.length;
      done += filed.length;
      if (filed.length > 0) void queryClient.invalidateQueries();
      else void queryClient.invalidateQueries({ queryKey: ['work', 'detail'] });
      const text = `${plural(done, 'item', 'items')} marked done`;
      const sub = skipped ? `${skipped} need their own form or review` : undefined;
      if (done > 0 && other === 0 && filed.length > 0 && MAY_REOPEN.has(user?.role ?? '')) {
        // Only filings changed, and this person may reopen them: the A2 toast can undo.
        toastUndo(sub ? `${text} · ${sub}` : text, () => {
          void setFilingStatus(filed, 'reopen').then(() => queryClient.invalidateQueries());
        });
      } else if (done > 0) {
        toastSaved(text, { sub });
      } else {
        toastError('Nothing could be marked done', 'These items finish in their own form or review.');
      }
      return done;
    },
    [approveDoc, submitDirectStep, updateTask, queryClient, user?.role],
  );
}

/* ------------------------------------------------------------- task status */

/**
 * The status words a task row may be set to from its chip (E-03). A task is open or done; the
 * other words come from its due date, so the menu offers only these two.
 */
export const TASK_STATUS_WORDS: readonly SixWord[] = ['In progress', 'Done'];

const TASK_STATUS_OF: Partial<Record<SixWord, StatusCode>> = { 'In progress': 'in-progress', Done: 'completed' };

/**
 * E-03 on a task row: saves the new status through `updateTask` (PATCH /api/tasks/:id) and shows
 * the A2 toast with Undo, which writes the previous status back.
 */
export function useSetTaskStatus() {
  const { updateTask } = useApp();
  return useCallback(
    (taskId: string, word: SixWord, previous: StatusCode | undefined, title: string) => {
      const next = TASK_STATUS_OF[word];
      if (!next) return;
      const before: StatusCode = previous ?? 'in-progress';
      updateTask(taskId, { status: next, updatedAt: new Date().toISOString() });
      toastUndo(`${title} · ${word}`, () => updateTask(taskId, { status: before, updatedAt: new Date().toISOString() }));
    },
    [updateTask],
  );
}
