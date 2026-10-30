'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FilterSelect } from '@/components/ui/native-select';
import { DateField } from '@/components/compliances/NewTaskDialog';
import { useTaskDefaults, type TaskDetailDto, type TaskEditBody } from '@/views/compliances/tasks/api';
import { REPEATS, URGENCIES, type TaskRepeats, type TaskUrgency, type TaskVisibility } from '@/views/compliances/tasks/task-model';

/**
 * EDIT TASK — the M2 form an admin, super admin or manager uses to change a non-statutory task
 * after creation (`PATCH /api/compliances/tasks/:id` with `action: 'edit'`). It starts from the
 * task's values and sends only what changed. The people lists come from the task defaults read
 * of the task's client.
 */

const VIS_OPTIONS: Array<{ value: TaskVisibility; label: string }> = [
  { value: 'firm', label: 'Firm only' },
  { value: 'client', label: 'Client only' },
  { value: 'both', label: 'Both' },
];

interface EditForm {
  name: string;
  start: string;
  end: string;
  urgency: TaskUrgency;
  vis: TaskVisibility;
  owner: string;
  reviewer: string;
  repeats: TaskRepeats;
  remind: string;
}

const fromTask = (t: TaskDetailDto): EditForm => ({
  name: t.name,
  start: t.startDate,
  end: t.dueDate,
  urgency: t.urgency,
  vis: t.visibility,
  owner: t.owner?.id ?? '',
  reviewer: t.reviewer?.id ?? '',
  repeats: t.repeats,
  remind: String(t.remindBefore),
});

/** The checks of the edit form. */
function editTaskErrors(f: EditForm): Partial<Record<'name' | 'start' | 'end' | 'remind', string>> {
  const n = Number(f.remind);
  return {
    name: !f.name.trim() ? 'Give the task a name' : f.name.trim().length > 120 ? 'Use 120 characters or fewer' : undefined,
    start: !f.start ? 'Pick a start date' : undefined,
    end: !f.end ? 'Pick an end date' : f.start && f.end < f.start ? 'End on or after the start' : undefined,
    remind: f.remind.trim() === '' || !Number.isInteger(n) || n < 0 || n > 90 ? 'Use 0 to 90 days' : undefined,
  };
}

/** Only the fields that changed, in the route's words. */
function editBody(task: TaskDetailDto, f: EditForm): TaskEditBody {
  const was = fromTask(task);
  const body: TaskEditBody = {};
  if (f.name.trim() !== was.name) body.name = f.name.trim();
  if (f.start !== was.start) body.startDate = f.start;
  if (f.end !== was.end) body.dueDate = f.end;
  if (f.urgency !== was.urgency) body.urgency = f.urgency;
  if (f.vis !== was.vis) body.visibility = f.vis;
  if (f.owner !== was.owner) body.ownerId = f.owner || null;
  if (f.reviewer !== was.reviewer) body.reviewerId = f.reviewer || null;
  if (f.repeats !== was.repeats) body.repeats = f.repeats;
  if (Number(f.remind) !== task.remindBefore) body.remindBefore = Number(f.remind);
  return body;
}

export function EditTaskDialog({
  open,
  onOpenChange,
  task,
  now,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: TaskDetailDto;
  now: Date;
  saving: boolean;
  /** Resolve true when the save went through. */
  onSave: (body: TaskEditBody) => Promise<boolean>;
}) {
  const defaults = useTaskDefaults(task.engagementId, open);
  const [f, setF] = useState<EditForm>(() => fromTask(task));
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (open) {
      setF(fromTask(task));
      setTried(false);
    }
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = (p: Partial<EditForm>) => setF((x) => ({ ...x, ...p }));
  const err = editTaskErrors(f);
  const e = (k: keyof typeof err) => (tried ? err[k] : undefined);

  // The current owner and reviewer stay pickable even before the people list loads.
  const withCurrent = (list: Array<{ id: string; name: string }>, cur: { id: string; name: string } | null) =>
    cur && !list.some((p) => p.id === cur.id) ? [cur, ...list] : list;
  const owners = withCurrent(defaults.data?.owners ?? [], task.owner);
  const reviewers = withCurrent(defaults.data?.reviewers ?? [], task.reviewer);

  const save = async () => {
    setTried(true);
    if (Object.values(err).some(Boolean) || saving) return;
    const body = editBody(task, f);
    if (Object.keys(body).length === 0) {
      onOpenChange(false);
      return;
    }
    if (await onSave(body)) onOpenChange(false);
  };
  const wide = 'w-full [&>select]:w-full';
  const year = now.getUTCFullYear();

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit task"
      eyebrow={task.companyName}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="edit-task" disabled={saving}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="edit-task"
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          void save();
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <Field label="Task name" className="sm:col-span-2" error={e('name')}>
          <Input aria-label="Task name" value={f.name} aria-invalid={e('name') ? true : undefined} onChange={(ev) => set({ name: ev.target.value })} />
        </Field>
        <Field label="Start date" error={e('start')}>
          <DateField label="Start date" value={f.start} onChange={(v) => set({ start: v })} invalid={!!e('start')} year={year} />
        </Field>
        <Field label="End date" error={e('end')}>
          <DateField label="End date" value={f.end} min={f.start || undefined} onChange={(v) => set({ end: v })} invalid={!!e('end')} year={year} />
        </Field>
        <Field label="Urgency">
          <FilterSelect
            aria-label="Urgency"
            size="md"
            className={wide}
            value={f.urgency}
            onChange={(ev) => set({ urgency: ev.target.value as TaskUrgency })}
            options={URGENCIES.map((u) => ({ value: u, label: u }))}
          />
        </Field>
        <Field label="Visible to">
          <FilterSelect aria-label="Visible to" size="md" className={wide} value={f.vis} onChange={(ev) => set({ vis: ev.target.value as TaskVisibility })} options={VIS_OPTIONS} />
        </Field>
        <Field label="Owner">
          <FilterSelect
            aria-label="Owner"
            size="md"
            className={wide}
            value={f.owner}
            onChange={(ev) => set({ owner: ev.target.value })}
            options={[{ value: '', label: 'No owner' }, ...owners.map((p) => ({ value: p.id, label: p.name }))]}
          />
        </Field>
        <Field label="Reviewer">
          <FilterSelect
            aria-label="Reviewer"
            size="md"
            className={wide}
            value={f.reviewer}
            onChange={(ev) => set({ reviewer: ev.target.value })}
            options={[{ value: '', label: 'No reviewer' }, ...reviewers.map((p) => ({ value: p.id, label: p.name }))]}
          />
        </Field>
        <Field label="Repeats">
          <FilterSelect
            aria-label="Repeats"
            size="md"
            className={wide}
            value={f.repeats}
            onChange={(ev) => set({ repeats: ev.target.value as TaskRepeats })}
            options={REPEATS.map((r) => ({ value: r.value, label: r.label }))}
          />
        </Field>
        <Field label="Remind before (days)" error={e('remind')}>
          <Input
            aria-label="Remind before (days)"
            type="number"
            min={0}
            max={90}
            inputMode="numeric"
            aria-invalid={e('remind') ? true : undefined}
            value={f.remind}
            onChange={(ev) => set({ remind: ev.target.value })}
          />
        </Field>
      </form>
    </Modal>
  );
}
